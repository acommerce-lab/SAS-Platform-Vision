"""WikiText-103 loading, vocabulary construction and integer encoding.

The tokenised WikiText-103 release (``wikitext-103-v1``) is used, read from the
parquet files published on the Hugging Face hub.  Each parquet row is one line
of the original ``wiki.*.tokens`` file.  Following the usual convention (Merity
et al. 2016, AWD-LSTM), every line (including empty ones) is split on
whitespace and terminated with ``<eos>``, which reproduces the standard token
counts (103,227,021 train / 217,646 valid / 245,569 test).
"""
from __future__ import annotations

import os
import re
import subprocess
import urllib.request
from collections import Counter

import numpy as np

HF_BASE = "https://huggingface.co/datasets/Salesforce/wikitext/resolve/main/wikitext-103-v1/"
FILES = {
    "train": ["train-00000-of-00002.parquet", "train-00001-of-00002.parquet"],
    "valid": ["validation-00000-of-00001.parquet"],
    "test": ["test-00000-of-00001.parquet"],
}
_HEADING = re.compile(r"^ = [^=].* = $")  # level-1 heading == article start


def download(data_dir: str) -> None:
    """Fetch the parquet shards if they are missing (urllib, then curl as fallback)."""
    os.makedirs(data_dir, exist_ok=True)
    for files in FILES.values():
        for f in files:
            path = os.path.join(data_dir, f)
            if os.path.exists(path) and os.path.getsize(path) > 0:
                continue
            url = HF_BASE + f
            print(f"[data] downloading {url}")
            try:
                urllib.request.urlretrieve(url, path)
            except Exception as exc:  # pragma: no cover - network specific
                print(f"[data] urllib failed ({exc}); trying curl")
                subprocess.run(["curl", "-sS", "-L", "-o", path, url], check=True)


def read_lines(data_dir: str, split: str) -> list[str]:
    import pyarrow.parquet as pq

    lines: list[str] = []
    for f in FILES[split]:
        table = pq.read_table(os.path.join(data_dir, f), columns=["text"])
        lines.extend(table.column("text").to_pylist())
    return lines


def lines_to_tokens(lines: list[str]) -> tuple[list[str], list[int]]:
    """Return the token stream and the token offsets at which articles start."""
    toks: list[str] = []
    starts: list[int] = []
    for line in lines:
        stripped = line.rstrip("\n")
        if _HEADING.match(stripped):
            starts.append(len(toks))
        toks.extend(stripped.split())
        toks.append("<eos>")
    return toks, starts


def build_vocab(train_tokens: list[str]) -> list[str]:
    """Vocabulary sorted by decreasing frequency, so id == frequency rank."""
    counts = Counter(train_tokens)
    return [w for w, _ in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))]


def encode(tokens: list[str], word2id: dict[str, int]) -> np.ndarray:
    unk = word2id["<unk>"]
    return np.fromiter((word2id.get(t, unk) for t in tokens), dtype=np.int32, count=len(tokens))


class Corpus:
    """Encoded train/valid/test streams plus vocabulary and article boundaries."""

    def __init__(self, data_dir: str, cache_dir: str | None = None, max_train_tokens: int | None = None):
        cache_dir = cache_dir or os.path.join(data_dir, "cache")
        os.makedirs(cache_dir, exist_ok=True)
        vocab_path = os.path.join(cache_dir, "vocab.txt")
        if not os.path.exists(vocab_path):
            download(data_dir)
            train_tokens, train_starts = lines_to_tokens(read_lines(data_dir, "train"))
            vocab = build_vocab(train_tokens)
            with open(vocab_path, "w", encoding="utf-8") as fh:
                fh.write("\n".join(vocab))
            word2id = {w: i for i, w in enumerate(vocab)}
            np.save(os.path.join(cache_dir, "train.npy"), encode(train_tokens, word2id))
            np.save(os.path.join(cache_dir, "train_starts.npy"), np.asarray(train_starts, dtype=np.int64))
            del train_tokens
            for split in ("valid", "test"):
                toks, starts = lines_to_tokens(read_lines(data_dir, split))
                np.save(os.path.join(cache_dir, f"{split}.npy"), encode(toks, word2id))
                np.save(os.path.join(cache_dir, f"{split}_starts.npy"), np.asarray(starts, dtype=np.int64))
        with open(vocab_path, encoding="utf-8") as fh:
            self.vocab = fh.read().split("\n")
        self.word2id = {w: i for i, w in enumerate(self.vocab)}
        self.V = len(self.vocab)
        self.train = np.load(os.path.join(cache_dir, "train.npy"))
        self.train_starts = np.load(os.path.join(cache_dir, "train_starts.npy"))
        if max_train_tokens is not None and max_train_tokens < len(self.train):
            self.train = self.train[:max_train_tokens]
            self.train_starts = self.train_starts[self.train_starts < max_train_tokens]
        self.valid = np.load(os.path.join(cache_dir, "valid.npy"))
        self.valid_starts = np.load(os.path.join(cache_dir, "valid_starts.npy"))
        self.test = np.load(os.path.join(cache_dir, "test.npy"))
        self.test_starts = np.load(os.path.join(cache_dir, "test_starts.npy"))

    def words(self, ids) -> list[str]:
        return [self.vocab[i] for i in ids]

    def is_content_word(self, wid: int, min_rank: int = 300) -> bool:
        w = self.vocab[wid]
        return wid >= min_rank and w.isalpha() and w not in ("<unk>", "<eos>")
