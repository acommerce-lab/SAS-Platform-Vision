import { useState } from "react";
import {
  useGetCurrentUser,
  useListShipperCustomers,
  useCreateShipperCustomer,
  useUpdateShipperCustomer,
  useDeleteShipperCustomer,
} from "@workspace/api-client-react";
import { Users, Plus, Pencil, Trash2, X, Check } from "lucide-react";

export function ShipperCustomers() {
  const { data: user } = useGetCurrentUser();
  const shipperId = user?.id ?? "";
  const { data: customers, isLoading, refetch } = useListShipperCustomers({ shipperId }, { query: { enabled: !!shipperId } });
  const createCustomer = useCreateShipperCustomer();
  const updateCustomer = useUpdateShipperCustomer();
  const deleteCustomer = useDeleteShipperCustomer();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "" });
  const [editing, setEditing] = useState<{ id: string; name: string; phone: string } | null>(null);

  async function handleCreate() {
    if (!form.name) return;
    await createCustomer.mutateAsync({ shipperId, data: form as any });
    setForm({ name: "", phone: "" });
    setShowForm(false);
    refetch();
  }

  async function handleUpdate() {
    if (!editing) return;
    await updateCustomer.mutateAsync({ shipperId, customerId: editing.id, data: { name: editing.name, phone: editing.phone } as any });
    setEditing(null);
    refetch();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground mt-1">Manage the customers you ship goods to.</p>
        </div>
        <button onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> Add Customer
        </button>
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">New Customer</h2>
            <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Customer name"
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Phone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+966501234567"
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={createCustomer.isPending}
              className="text-sm font-semibold bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50">
              Save Customer
            </button>
            <button onClick={() => setShowForm(false)} className="text-sm font-semibold border border-border px-4 py-2 rounded-lg hover:bg-secondary transition-colors">Cancel</button>
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-border">{[1,2,3].map(i => <div key={i} className="px-6 py-4 h-14 animate-pulse bg-muted/20" />)}</div>
        ) : (customers ?? []).length === 0 ? (
          <div className="px-6 py-16 text-center text-muted-foreground">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No customers yet</p>
          </div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-secondary/50 border-b border-border">
              <tr>
                <th className="px-6 py-3 font-medium">Name</th>
                <th className="px-6 py-3 font-medium">Phone</th>
                <th className="px-6 py-3 font-medium">Added</th>
                <th className="px-6 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(customers ?? []).map((c: any) => (
                <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-3">
                    {editing?.id === c.id ? (
                      <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                        className="h-8 rounded-md border border-input bg-background px-2 text-sm w-48 outline-none focus:ring-2 focus:ring-primary/20" />
                    ) : (
                      <span className="font-semibold">{c.name}</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-muted-foreground font-mono text-xs">
                    {editing?.id === c.id ? (
                      <input value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                        className="h-8 rounded-md border border-input bg-background px-2 text-sm w-36 outline-none focus:ring-2 focus:ring-primary/20" />
                    ) : (
                      c.phone ?? "—"
                    )}
                  </td>
                  <td className="px-6 py-3 text-muted-foreground text-xs font-mono">{new Date(c.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {editing?.id === c.id ? (
                        <>
                          <button onClick={handleUpdate} className="inline-flex items-center gap-1 text-xs font-semibold bg-success/10 text-success border border-success/20 px-2.5 py-1.5 rounded-md hover:bg-success/20">
                            <Check className="w-3.5 h-3.5" /> Save
                          </button>
                          <button onClick={() => setEditing(null)} className="text-xs font-semibold border border-border px-2.5 py-1.5 rounded-md hover:bg-secondary">
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => setEditing({ id: c.id, name: c.name, phone: c.phone ?? "" })}
                            className="inline-flex items-center gap-1 text-xs font-semibold bg-secondary border border-border px-2.5 py-1.5 rounded-md hover:bg-secondary/80">
                            <Pencil className="w-3.5 h-3.5" /> Edit
                          </button>
                          <button onClick={async () => { await deleteCustomer.mutateAsync({ shipperId, customerId: c.id }); refetch(); }}
                            className="inline-flex items-center gap-1 text-xs text-destructive opacity-60 hover:opacity-100 font-semibold">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
