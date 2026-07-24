import { useState } from "react";
import {
  useListSupportTickets,
  useCreateSupportTicket,
  useGetSupportTicket,
  useUpdateSupportTicket,
  useReplySupportTicket,
} from "@workspace/api-client-react";
import { useGetCurrentUser } from "@workspace/api-client-react";
import { LifeBuoy, Plus, X, Send } from "lucide-react";

const TICKET_STATUS_COLORS: Record<string, string> = {
  open: "bg-warning/10 text-warning border-warning/20",
  in_progress: "bg-primary/10 text-primary border-primary/20",
  resolved: "bg-success/10 text-success border-success/20",
  closed: "bg-muted text-muted-foreground border-border",
};

export default function Support() {
  const { data: user } = useGetCurrentUser();
  const { data: tickets, isLoading, refetch } = useListSupportTickets();
  const createTicket = useCreateSupportTicket();
  const replyTicket = useReplySupportTicket();
  const updateTicket = useUpdateSupportTicket();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newForm, setNewForm] = useState({ subject: "", message: "" });
  const [replyText, setReplyText] = useState("");

  const { data: detail, refetch: refetchDetail } = useGetSupportTicket(
    { ticketId: selectedId! },
    { query: { enabled: !!selectedId } }
  );

  const ticketList = tickets ?? [];

  async function handleCreate() {
    if (!newForm.subject || !newForm.message) return;
    const t = await createTicket.mutateAsync({ data: newForm as any });
    setNewForm({ subject: "", message: "" });
    setShowCreate(false);
    refetch();
    setSelectedId(t.id);
  }

  async function handleReply() {
    if (!replyText.trim() || !selectedId) return;
    await replyTicket.mutateAsync({ ticketId: selectedId, data: { content: replyText } as any });
    setReplyText("");
    refetchDetail();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Support</h1>
          <p className="text-muted-foreground mt-1">Submit and track support tickets.</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> New Ticket
        </button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="font-bold text-lg">New Support Ticket</h2>
              <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Subject</label>
                <input value={newForm.subject} onChange={(e) => setNewForm({ ...newForm, subject: e.target.value })} placeholder="Briefly describe your issue"
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Message</label>
                <textarea value={newForm.message} onChange={(e) => setNewForm({ ...newForm, message: e.target.value })} placeholder="Describe the issue in detail"
                  rows={4}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-border">
              <button onClick={handleCreate} disabled={createTicket.isPending || !newForm.subject || !newForm.message}
                className="flex-1 text-sm font-bold bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50">
                {createTicket.isPending ? "Submitting..." : "Submit Ticket"}
              </button>
              <button onClick={() => setShowCreate(false)} className="text-sm font-semibold border border-border px-4 py-2 rounded-lg hover:bg-secondary transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden flex h-[calc(100vh-260px)] min-h-[400px]">
        {/* Ticket list */}
        <div className="w-80 border-r border-border flex flex-col">
          <div className="p-3 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Tickets ({ticketList.length})
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {isLoading ? (
              <div className="p-4 space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}</div>
            ) : ticketList.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                <LifeBuoy className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No tickets yet</p>
              </div>
            ) : (ticketList as any[]).map((t: any) => (
              <button key={t.id} onClick={() => setSelectedId(t.id)}
                className={`w-full text-left px-4 py-3 transition-colors ${selectedId === t.id ? "bg-primary/10" : "hover:bg-secondary/50"}`}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-sm font-semibold truncate">{t.subject}</p>
                  <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-semibold border flex-shrink-0 ${TICKET_STATUS_COLORS[t.status] ?? ""}`}>
                    {t.status.replace(/_/g, " ")}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground font-mono">{new Date(t.created_at).toLocaleDateString()}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Ticket detail */}
        <div className="flex-1 flex flex-col">
          {!selectedId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <LifeBuoy className="w-12 h-12 mb-3 opacity-20" />
              <p className="font-medium">Select a ticket</p>
              <p className="text-sm">to view the conversation</p>
            </div>
          ) : !detail ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <div className="px-6 py-3 border-b border-border flex items-center justify-between">
                <div>
                  <p className="font-bold">{(detail as any).subject}</p>
                  <p className="text-xs text-muted-foreground">Opened {new Date((detail as any).created_at).toLocaleString()}</p>
                </div>
                {user?.role === "admin" && (
                  <div className="flex gap-2">
                    {["open", "in_progress", "resolved", "closed"].map((s) => (
                      (detail as any).status !== s && (
                        <button key={s} onClick={async () => { await updateTicket.mutateAsync({ ticketId: selectedId, data: { status: s } as any }); refetchDetail(); refetch(); }}
                          className="text-xs font-semibold border border-border px-2 py-1 rounded hover:bg-secondary transition-colors capitalize">
                          {s.replace(/_/g, " ")}
                        </button>
                      )
                    ))}
                  </div>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {((detail as any).messages ?? []).map((m: any) => (
                  <div key={m.id} className="flex gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${m.sender_role === "admin" ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}>
                      {m.sender_role.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1 font-medium capitalize">{m.sender_role} · {new Date(m.created_at).toLocaleTimeString()}</p>
                      <div className={`rounded-xl px-4 py-2.5 text-sm inline-block max-w-lg ${m.sender_role === "admin" ? "bg-primary/10" : "bg-secondary"}`}>
                        {m.content}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {(detail as any).status !== "closed" && (
                <div className="p-4 border-t border-border flex gap-3">
                  <input value={replyText} onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleReply()}
                    placeholder="Write a reply…"
                    className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
                  <button onClick={handleReply} disabled={!replyText.trim() || replyTicket.isPending}
                    className="h-9 w-9 rounded-md bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-50">
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
