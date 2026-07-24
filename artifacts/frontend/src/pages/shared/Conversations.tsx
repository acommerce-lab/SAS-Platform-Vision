import { useState } from "react";
import {
  useListConversations,
  useCreateConversation,
  useListMessages,
  useSendMessage,
} from "@workspace/api-client-react";
import { MessageSquare, Send, Plus } from "lucide-react";

export default function Conversations() {
  const { data: conversations, isLoading, refetch } = useListConversations();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const createConversation = useCreateConversation();
  const sendMessage = useSendMessage();

  const { data: messages, refetch: refetchMessages } = useListMessages(
    { conversationId: selectedId! },
    { query: { enabled: !!selectedId } }
  );

  const convos = conversations ?? [];
  const selectedConvo = convos.find((c: any) => c.id === selectedId);

  async function handleSend() {
    if (!newMessage.trim() || !selectedId) return;
    await sendMessage.mutateAsync({ conversationId: selectedId, data: { content: newMessage } as any });
    setNewMessage("");
    refetchMessages();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Conversations</h1>
          <p className="text-muted-foreground mt-1">Communicate with carriers and shippers.</p>
        </div>
        <button
          onClick={async () => { const c = await createConversation.mutateAsync({ data: {} as any }); refetch(); setSelectedId(c.id); }}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" /> New Conversation
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden flex h-[calc(100vh-260px)] min-h-[400px]">
        {/* Sidebar */}
        <div className="w-72 border-r border-border flex flex-col">
          <div className="p-3 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Conversations ({convos.length})
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />)}
              </div>
            ) : convos.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No conversations yet</p>
              </div>
            ) : convos.map((c: any) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`w-full text-left px-4 py-3 transition-colors ${selectedId === c.id ? "bg-primary/10" : "hover:bg-secondary/50"}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {c.shipment_id ? `Shipment: ${c.shipment_id.slice(0, 8)}…` : "General"}
                    </p>
                    {c.last_message && <p className="text-xs text-muted-foreground truncate">{c.last_message}</p>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Message area */}
        <div className="flex-1 flex flex-col">
          {!selectedId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <MessageSquare className="w-12 h-12 mb-3 opacity-20" />
              <p className="font-medium">Select a conversation</p>
              <p className="text-sm">or start a new one</p>
            </div>
          ) : (
            <>
              <div className="px-6 py-3 border-b border-border flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <p className="font-semibold text-sm">
                  {selectedConvo?.shipment_id ? `Shipment ${selectedConvo.shipment_id.slice(0, 8)}…` : "General Conversation"}
                </p>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-3">
                {(messages ?? []).length === 0 ? (
                  <div className="text-center text-muted-foreground text-sm py-8">No messages yet. Say hello!</div>
                ) : (messages as any[]).map((m: any) => (
                  <div key={m.id} className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {m.sender_role.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1 font-medium capitalize">{m.sender_role} · {new Date(m.created_at).toLocaleTimeString()}</p>
                      <div className="bg-secondary rounded-xl px-4 py-2 text-sm inline-block max-w-lg">
                        {m.content}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 border-t border-border flex gap-3">
                <input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                  placeholder="Type a message…"
                  className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
                <button onClick={handleSend} disabled={!newMessage.trim() || sendMessage.isPending}
                  className="h-9 w-9 rounded-md bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-50">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
