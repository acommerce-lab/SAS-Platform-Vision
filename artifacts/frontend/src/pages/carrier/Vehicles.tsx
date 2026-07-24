import { useState } from "react";
import { useGetCurrentUser, useListVehicles, useAddVehicle, useRemoveVehicle } from "@workspace/api-client-react";
import { Truck, Plus, Trash2 } from "lucide-react";

const VEHICLE_TYPES = ["flatbed", "refrigerated", "cage", "tow_truck", "curtain_side", "container", "low_bed", "other"];
const VEHICLE_CATEGORIES = ["dyna", "single_truck", "trailer", "semi_trailer", "road_train", "other"];

export function CarrierVehicles() {
  const { data: user } = useGetCurrentUser();
  const carrierId = user?.id ?? "";
  const { data: vehicles, isLoading, refetch } = useListVehicles({ carrierId }, { query: { enabled: !!carrierId } });
  const addVehicle = useAddVehicle();
  const removeVehicle = useRemoveVehicle();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ vehicle_type: "flatbed", vehicle_category: "single_truck", plate_number: "" });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fleet Vehicles</h1>
          <p className="text-muted-foreground mt-1">Manage vehicles registered to your carrier account.</p>
        </div>
        <button onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> Add Vehicle
        </button>
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="font-semibold">New Vehicle</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Type</label>
              <select value={form.vehicle_type} onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20">
                {VEHICLE_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Category</label>
              <select value={form.vehicle_category} onChange={(e) => setForm({ ...form, vehicle_category: e.target.value })}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20">
                {VEHICLE_CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Plate Number</label>
              <input value={form.plate_number} onChange={(e) => setForm({ ...form, plate_number: e.target.value })} placeholder="ABC-1234"
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={async () => {
              if (!form.plate_number) return;
              await addVehicle.mutateAsync({ carrierId, data: form as any });
              setForm({ vehicle_type: "flatbed", vehicle_category: "single_truck", plate_number: "" });
              setShowForm(false);
              refetch();
            }} className="text-sm font-semibold bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors">
              Save Vehicle
            </button>
            <button onClick={() => setShowForm(false)} className="text-sm font-semibold border border-border px-4 py-2 rounded-lg hover:bg-secondary transition-colors">Cancel</button>
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-border">{[1,2,3].map(i => <div key={i} className="px-6 py-4 animate-pulse h-14 bg-muted/30" />)}</div>
        ) : (vehicles ?? []).length === 0 ? (
          <div className="px-6 py-16 text-center text-muted-foreground">
            <Truck className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No vehicles yet. Add your first vehicle to start receiving shipments.</p>
          </div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-secondary/50 border-b border-border">
              <tr>
                <th className="px-6 py-3 font-medium">Type</th>
                <th className="px-6 py-3 font-medium">Category</th>
                <th className="px-6 py-3 font-medium">Plate Number</th>
                <th className="px-6 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(vehicles ?? []).map((v) => (
                <tr key={v.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-3 font-medium capitalize">{v.vehicle_type?.replace(/_/g, " ")}</td>
                  <td className="px-6 py-3 text-muted-foreground capitalize">{v.vehicle_category?.replace(/_/g, " ")}</td>
                  <td className="px-6 py-3 font-mono font-semibold">{v.plate_number}</td>
                  <td className="px-6 py-3 text-right">
                    <button onClick={async () => { await removeVehicle.mutateAsync({ carrierId, vehicleId: v.id! }); refetch(); }}
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
