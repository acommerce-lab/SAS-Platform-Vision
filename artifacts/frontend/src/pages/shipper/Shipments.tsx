import { useState } from "react";
import { Link } from "wouter";
import {
  useListShipments,
  useCreateShipment,
  useApprovePricing,
  useRejectPricing,
  useGetCurrentUser,
  useListShipperCustomers,
  useListProducts,
} from "@workspace/api-client-react";
import { Package, Plus, CheckCircle2, XCircle, X } from "lucide-react";

const VEHICLE_TYPES = ["flatbed", "refrigerated", "cage", "tow_truck", "curtain_side", "container", "low_bed", "other"];
const VEHICLE_CATEGORIES = ["dyna", "single_truck", "trailer", "semi_trailer", "road_train", "other"];

const STATUS_COLORS: Record<string, string> = {
  requested: "bg-secondary text-secondary-foreground border-border",
  carrier_assigned: "bg-primary/10 text-primary border-primary/20",
  pricing_sent: "bg-accent/10 text-accent border-accent/20",
  pricing_approved: "bg-success/10 text-success border-success/20",
  pricing_rejected: "bg-destructive/10 text-destructive border-destructive/20",
  waybill_issued: "bg-primary/10 text-primary border-primary/20",
  in_transit: "bg-warning/10 text-warning border-warning/20",
  delivered: "bg-success/10 text-success border-success/20",
  cancelled: "bg-muted text-muted-foreground border-border",
};

const defaultForm = {
  pickup_location: "",
  dropoff_location: "",
  cargo_description: "",
  required_vehicle_type: "flatbed",
  required_vehicle_category: "single_truck",
  shipper_customer_id: "",
  product_id: "",
};

export function ShipperShipments() {
  const { data: user } = useGetCurrentUser();
  const shipperId = user?.id ?? "";

  const [filter, setFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [formError, setFormError] = useState("");

  const { data, isLoading, refetch } = useListShipments({ status: filter === "all" ? undefined : filter });
  const { data: customers } = useListShipperCustomers({ shipperId }, { query: { enabled: !!shipperId } });
  const { data: products } = useListProducts({ shipperId }, { query: { enabled: !!shipperId } });

  const createShipment = useCreateShipment();
  const approvePricing = useApprovePricing();
  const rejectPricing = useRejectPricing();

  const shipments = data?.data ?? [];

  async function handleCreate() {
    if (!form.pickup_location || !form.dropoff_location) {
      setFormError("Pickup and dropoff locations are required.");
      return;
    }
    setFormError("");
    try {
      await createShipment.mutateAsync({
        data: {
          ...form,
          shipper_customer_id: form.shipper_customer_id || undefined,
          product_id: form.product_id || undefined,
          cargo_description: form.cargo_description || undefined,
        } as any,
      });
      setForm(defaultForm);
      setShowCreate(false);
      refetch();
    } catch (err: any) {
      setFormError(err?.error?.message ?? "Failed to create shipment");
    }
  }

  const STATUS_OPTIONS = ["all", "requested", "pricing_sent", "pricing_approved", "waybill_issued", "in_transit", "delivered", "cancelled"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Shipments</h1>
          <p className="text-muted-foreground mt-1">Track your freight and manage pricing approvals.</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 bg-accent text-accent-foreground px-4 py-2 rounded-lg text-sm font-bold hover:bg-accent/90 transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> New Shipment
        </button>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="font-bold text-lg">New Shipment</h2>
              <button onClick={() => { setShowCreate(false); setFormError(""); }} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {formError && <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-md">{formError}</div>}
              <div className="grid grid-cols-1 gap-4">
                {[
                  { label: "Pickup Location", key: "pickup_location", placeholder: "e.g. Riyadh, Saudi Arabia" },
                  { label: "Dropoff Location", key: "dropoff_location", placeholder: "e.g. Jeddah, Saudi Arabia" },
                  { label: "Cargo Description", key: "cargo_description", placeholder: "What are you shipping?" },
                ].map(({ label, key, placeholder }) => (
                  <div key={key}>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">{label}</label>
                    <input value={(form as any)[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} placeholder={placeholder}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Vehicle Type</label>
                    <select value={form.required_vehicle_type} onChange={(e) => setForm({ ...form, required_vehicle_type: e.target.value })}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20">
                      {VEHICLE_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Category</label>
                    <select value={form.required_vehicle_category} onChange={(e) => setForm({ ...form, required_vehicle_category: e.target.value })}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20">
                      {VEHICLE_CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Customer (optional)</label>
                    <select value={form.shipper_customer_id} onChange={(e) => setForm({ ...form, shipper_customer_id: e.target.value })}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20">
                      <option value="">None</option>
                      {(customers ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Product (optional)</label>
                    <select value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20">
                      <option value="">None</option>
                      {(products ?? []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-border">
              <button onClick={handleCreate} disabled={createShipment.isPending}
                className="flex-1 text-sm font-bold bg-accent text-accent-foreground px-4 py-2 rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50">
                {createShipment.isPending ? "Creating..." : "Create Shipment"}
              </button>
              <button onClick={() => { setShowCreate(false); setFormError(""); }}
                className="text-sm font-semibold border border-border px-4 py-2 rounded-lg hover:bg-secondary transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-1 bg-secondary/50 p-1 rounded-lg border border-border w-fit overflow-x-auto">
        {STATUS_OPTIONS.map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize whitespace-nowrap transition-all ${filter === s ? "bg-background shadow text-foreground border border-border" : "text-muted-foreground hover:text-foreground"}`}>
            {s.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-border">{[1,2,3].map(i => <div key={i} className="px-6 py-4 h-16 animate-pulse bg-muted/20" />)}</div>
        ) : shipments.length === 0 ? (
          <div className="px-6 py-16 text-center text-muted-foreground">
            <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No shipments found</p>
            <p className="text-sm mt-1">Create your first shipment to get started.</p>
          </div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground bg-secondary/50 uppercase border-b border-border">
              <tr>
                <th className="px-6 py-3 font-medium">Reference</th>
                <th className="px-6 py-3 font-medium">Route</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Quote</th>
                <th className="px-6 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shipments.map((s) => (
                <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-3 font-mono font-semibold text-primary">
                    <Link href={`/shipper/shipments/${s.id}`}>{s.reference_number}</Link>
                  </td>
                  <td className="px-6 py-3 max-w-xs">
                    <div className="truncate font-medium">{s.pickup_location}</div>
                    <div className="truncate text-muted-foreground text-xs">↓ {s.dropoff_location}</div>
                  </td>
                  <td className="px-6 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-semibold border ${STATUS_COLORS[s.status] ?? "bg-secondary text-secondary-foreground border-border"}`}>
                      {s.status?.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-6 py-3 font-mono text-sm">
                    {s.quoted_price ? <span className="font-bold text-accent">{s.quoted_price} SAR</span> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {s.status === "pricing_sent" && (
                        <>
                          <button onClick={async () => { await approvePricing.mutateAsync({ shipmentId: s.id }); refetch(); }}
                            className="inline-flex items-center gap-1 text-xs font-semibold bg-success/10 text-success border border-success/20 px-2.5 py-1.5 rounded-md hover:bg-success/20">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                          </button>
                          <button onClick={async () => { await rejectPricing.mutateAsync({ shipmentId: s.id }); refetch(); }}
                            className="inline-flex items-center gap-1 text-xs font-semibold bg-destructive/10 text-destructive border border-destructive/20 px-2.5 py-1.5 rounded-md hover:bg-destructive/20">
                            <XCircle className="w-3.5 h-3.5" /> Reject
                          </button>
                        </>
                      )}
                      <Link href={`/shipper/shipments/${s.id}`}
                        className="text-xs font-semibold bg-background border border-border px-2.5 py-1.5 rounded-md hover:bg-secondary transition-colors">
                        View
                      </Link>
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
