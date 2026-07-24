import { useState } from "react";
import {
  useGetCurrentUser,
  useListProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
} from "@workspace/api-client-react";
import { Package, Plus, Pencil, Trash2, X, Check } from "lucide-react";

export function ShipperProducts() {
  const { data: user } = useGetCurrentUser();
  const shipperId = user?.id ?? "";
  const { data: products, isLoading, refetch } = useListProducts({ shipperId }, { query: { enabled: !!shipperId } });
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const [editing, setEditing] = useState<{ id: string; name: string; description: string } | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Products</h1>
          <p className="text-muted-foreground mt-1">Manage your product catalog for shipments.</p>
        </div>
        <button onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> Add Product
        </button>
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">New Product</h2>
            <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Product Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Steel Beams"
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Description</label>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional description"
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={async () => {
              if (!form.name) return;
              await createProduct.mutateAsync({ shipperId, data: form as any });
              setForm({ name: "", description: "" });
              setShowForm(false);
              refetch();
            }} className="text-sm font-semibold bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors">
              Save Product
            </button>
            <button onClick={() => setShowForm(false)} className="text-sm font-semibold border border-border px-4 py-2 rounded-lg hover:bg-secondary transition-colors">Cancel</button>
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-border">{[1,2,3].map(i => <div key={i} className="px-6 py-4 h-14 animate-pulse bg-muted/20" />)}</div>
        ) : (products ?? []).length === 0 ? (
          <div className="px-6 py-16 text-center text-muted-foreground">
            <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No products yet</p>
            <p className="text-sm mt-1">Add products to quickly tag them in shipments.</p>
          </div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-secondary/50 border-b border-border">
              <tr>
                <th className="px-6 py-3 font-medium">Product</th>
                <th className="px-6 py-3 font-medium">Description</th>
                <th className="px-6 py-3 font-medium">Added</th>
                <th className="px-6 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(products ?? []).map((p: any) => (
                <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-3">
                    {editing?.id === p.id ? (
                      <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                        className="h-8 rounded-md border border-input bg-background px-2 text-sm w-40 outline-none focus:ring-2 focus:ring-primary/20" />
                    ) : <span className="font-semibold">{p.name}</span>}
                  </td>
                  <td className="px-6 py-3 text-muted-foreground max-w-xs">
                    {editing?.id === p.id ? (
                      <input value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                        className="h-8 rounded-md border border-input bg-background px-2 text-sm w-48 outline-none focus:ring-2 focus:ring-primary/20" />
                    ) : (p.description ?? "—")}
                  </td>
                  <td className="px-6 py-3 text-muted-foreground text-xs font-mono">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {editing?.id === p.id ? (
                        <>
                          <button onClick={async () => {
                            if (!editing) return;
                            await updateProduct.mutateAsync({ shipperId, productId: editing.id, data: { name: editing.name, description: editing.description } as any });
                            setEditing(null);
                            refetch();
                          }} className="inline-flex items-center gap-1 text-xs font-semibold bg-success/10 text-success border border-success/20 px-2.5 py-1.5 rounded-md hover:bg-success/20">
                            <Check className="w-3.5 h-3.5" /> Save
                          </button>
                          <button onClick={() => setEditing(null)} className="text-xs font-semibold border border-border px-2.5 py-1.5 rounded-md hover:bg-secondary">Cancel</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => setEditing({ id: p.id, name: p.name, description: p.description ?? "" })}
                            className="inline-flex items-center gap-1 text-xs font-semibold bg-secondary border border-border px-2.5 py-1.5 rounded-md hover:bg-secondary/80">
                            <Pencil className="w-3.5 h-3.5" /> Edit
                          </button>
                          <button onClick={async () => { await deleteProduct.mutateAsync({ shipperId, productId: p.id }); refetch(); }}
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
