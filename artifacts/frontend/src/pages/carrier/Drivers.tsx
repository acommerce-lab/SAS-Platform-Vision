import { useState } from "react";
import { useGetCurrentUser, useListDrivers, useCreateDriver, useRemoveDriver } from "@workspace/api-client-react";
import { Users, Plus, Trash2 } from "lucide-react";

export function CarrierDrivers() {
  const { data: user } = useGetCurrentUser();
  const carrierId = user?.id ?? "";
  const { data: drivers, isLoading, refetch } = useListDrivers({ carrierId }, { query: { enabled: !!carrierId } });
  const createDriver = useCreateDriver();
  const removeDriver = useRemoveDriver();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "" });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Drivers</h1>
          <p className="text-muted-foreground mt-1">Manage drivers assigned to your carrier.</p>
        </div>
        <button onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> Add Driver
        </button>
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="font-semibold">New Driver</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Full Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Driver full name"
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Phone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+966501234567"
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={async () => {
              if (!form.name) return;
              await createDriver.mutateAsync({ carrierId, data: form as any });
              setForm({ name: "", phone: "" });
              setShowForm(false);
              refetch();
            }} className="text-sm font-semibold bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors">
              Save Driver
            </button>
            <button onClick={() => setShowForm(false)} className="text-sm font-semibold border border-border px-4 py-2 rounded-lg hover:bg-secondary transition-colors">Cancel</button>
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-border">{[1,2,3].map(i => <div key={i} className="px-6 py-4 animate-pulse h-14 bg-muted/30" />)}</div>
        ) : (drivers ?? []).length === 0 ? (
          <div className="px-6 py-16 text-center text-muted-foreground">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No drivers yet. Add drivers to your fleet.</p>
          </div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-secondary/50 border-b border-border">
              <tr>
                <th className="px-6 py-3 font-medium">Name</th>
                <th className="px-6 py-3 font-medium">Phone</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(drivers ?? []).map((d) => (
                <tr key={d.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-3 font-semibold">{d.name}</td>
                  <td className="px-6 py-3 text-muted-foreground font-mono text-xs">{d.phone}</td>
                  <td className="px-6 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${d.status === "active" ? "bg-success/10 text-success" : "bg-secondary text-muted-foreground"}`}>
                      {d.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <button onClick={async () => { await removeDriver.mutateAsync({ carrierId, driverId: d.id! }); refetch(); }}
                      className="inline-flex items-center gap-1 text-xs text-destructive font-medium opacity-60 hover:opacity-100 transition-opacity">
                      <Trash2 className="w-3.5 h-3.5" /> Remove
                    </button>
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
