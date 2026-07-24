import { Link } from "wouter";
import {
  useGetCarrier,
  useListVehicles,
  useListDrivers,
  useActivateCarrier,
  useDisableCarrier,
  useAddVehicle,
  useRemoveVehicle,
  useCreateDriver,
  useRemoveDriver,
} from "@workspace/api-client-react";
import { ArrowLeft, Truck, Users, Plus, Trash2, CheckCircle2, XCircle } from "lucide-react";
import { useState } from "react";

const VEHICLE_TYPES = ["flatbed", "refrigerated", "cage", "tow_truck", "curtain_side", "container", "low_bed", "other"];
const VEHICLE_CATEGORIES = ["dyna", "single_truck", "trailer", "semi_trailer", "road_train", "other"];

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-success/10 text-success border-success/20",
    pending_activation: "bg-warning/10 text-warning border-warning/20",
    disabled: "bg-destructive/10 text-destructive border-destructive/20",
  };
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-semibold border ${map[status] ?? "bg-secondary text-secondary-foreground border-border"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function AdminCarrierDetail({ id }: { id: string }) {
  const { data: carrier, isLoading, refetch: refetchCarrier } = useGetCarrier({ carrierId: id });
  const { data: vehicles, refetch: refetchVehicles } = useListVehicles({ carrierId: id });
  const { data: drivers, refetch: refetchDrivers } = useListDrivers({ carrierId: id });
  const activate = useActivateCarrier();
  const disable = useDisableCarrier();
  const addVehicle = useAddVehicle();
  const removeVehicle = useRemoveVehicle();
  const createDriver = useCreateDriver();
  const removeDriver = useRemoveDriver();

  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [showAddDriver, setShowAddDriver] = useState(false);
  const [vehicleForm, setVehicleForm] = useState({ vehicle_type: "flatbed", vehicle_category: "single_truck", plate_number: "" });
  const [driverForm, setDriverForm] = useState({ name: "", phone: "" });

  if (isLoading || !carrier) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-6 bg-muted rounded w-24" />
        <div className="h-32 bg-muted rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/carriers" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Carriers
        </Link>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xl">
              {carrier.name.charAt(0)}
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{carrier.name}</h1>
              <p className="text-muted-foreground mt-0.5">{carrier.email} {carrier.phone && `· ${carrier.phone}`}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={carrier.status} />
            {carrier.status === "pending_activation" && (
              <button
                onClick={async () => { await activate.mutateAsync({ carrierId: id }); refetchCarrier(); }}
                className="inline-flex items-center gap-2 bg-success text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-success/90 transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" /> Activate Carrier
              </button>
            )}
            {carrier.status === "active" && (
              <button
                onClick={async () => { await disable.mutateAsync({ carrierId: id }); refetchCarrier(); }}
                className="inline-flex items-center gap-2 bg-destructive/10 text-destructive border border-destructive/20 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-destructive/20 transition-colors"
              >
                <XCircle className="w-4 h-4" /> Disable Carrier
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Vehicles */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold">
            <Truck className="w-4 h-4 text-primary" /> Vehicles ({vehicles?.length ?? 0})
          </div>
          <button
            onClick={() => setShowAddVehicle((v) => !v)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-primary/10 text-primary border border-primary/20 px-3 py-1.5 rounded-md hover:bg-primary/20 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Vehicle
          </button>
        </div>
        {showAddVehicle && (
          <div className="px-6 py-4 border-b border-border bg-secondary/20">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select value={vehicleForm.vehicle_type} onChange={(e) => setVehicleForm({ ...vehicleForm, vehicle_type: e.target.value })}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20">
                {VEHICLE_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
              </select>
              <select value={vehicleForm.vehicle_category} onChange={(e) => setVehicleForm({ ...vehicleForm, vehicle_category: e.target.value })}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20">
                {VEHICLE_CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
              </select>
              <input value={vehicleForm.plate_number} onChange={(e) => setVehicleForm({ ...vehicleForm, plate_number: e.target.value })}
                placeholder="Plate number"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={async () => {
                  await addVehicle.mutateAsync({ carrierId: id, data: vehicleForm as any });
                  setVehicleForm({ vehicle_type: "flatbed", vehicle_category: "single_truck", plate_number: "" });
                  setShowAddVehicle(false);
                  refetchVehicles();
                }}
                className="text-xs font-semibold bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:bg-primary/90 transition-colors"
              >
                Save Vehicle
              </button>
              <button onClick={() => setShowAddVehicle(false)} className="text-xs font-semibold border border-border px-3 py-1.5 rounded-md hover:bg-secondary transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-secondary/30 border-b border-border">
            <tr>
              <th className="px-6 py-3 font-medium">Type</th>
              <th className="px-6 py-3 font-medium">Category</th>
              <th className="px-6 py-3 font-medium">Plate</th>
              <th className="px-6 py-3 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(vehicles ?? []).length === 0 ? (
              <tr><td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">No vehicles added yet</td></tr>
            ) : (vehicles ?? []).map((v) => (
              <tr key={v.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-6 py-3 font-medium capitalize">{v.vehicle_type?.replace(/_/g, " ")}</td>
                <td className="px-6 py-3 text-muted-foreground capitalize">{v.vehicle_category?.replace(/_/g, " ")}</td>
                <td className="px-6 py-3 font-mono text-sm">{v.plate_number}</td>
                <td className="px-6 py-3 text-right">
                  <button onClick={async () => { await removeVehicle.mutateAsync({ carrierId: id, vehicleId: v.id! }); refetchVehicles(); }}
                    className="inline-flex items-center gap-1 text-xs text-destructive hover:text-destructive font-medium opacity-60 hover:opacity-100 transition-opacity">
                    <Trash2 className="w-3.5 h-3.5" /> Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Drivers */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold">
            <Users className="w-4 h-4 text-primary" /> Drivers ({drivers?.length ?? 0})
          </div>
          <button
            onClick={() => setShowAddDriver((v) => !v)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-primary/10 text-primary border border-primary/20 px-3 py-1.5 rounded-md hover:bg-primary/20 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Driver
          </button>
        </div>
        {showAddDriver && (
          <div className="px-6 py-4 border-b border-border bg-secondary/20">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input value={driverForm.name} onChange={(e) => setDriverForm({ ...driverForm, name: e.target.value })} placeholder="Driver name"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
              <input value={driverForm.phone} onChange={(e) => setDriverForm({ ...driverForm, phone: e.target.value })} placeholder="Phone number"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={async () => {
                  await createDriver.mutateAsync({ carrierId: id, data: driverForm as any });
                  setDriverForm({ name: "", phone: "" });
                  setShowAddDriver(false);
                  refetchDrivers();
                }}
                className="text-xs font-semibold bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:bg-primary/90 transition-colors"
              >
                Save Driver
              </button>
              <button onClick={() => setShowAddDriver(false)} className="text-xs font-semibold border border-border px-3 py-1.5 rounded-md hover:bg-secondary transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-secondary/30 border-b border-border">
            <tr>
              <th className="px-6 py-3 font-medium">Name</th>
              <th className="px-6 py-3 font-medium">Phone</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(drivers ?? []).length === 0 ? (
              <tr><td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">No drivers added yet</td></tr>
            ) : (drivers ?? []).map((d) => (
              <tr key={d.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-6 py-3 font-semibold">{d.name}</td>
                <td className="px-6 py-3 text-muted-foreground font-mono text-xs">{d.phone}</td>
                <td className="px-6 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${d.status === "active" ? "bg-success/10 text-success" : "bg-secondary text-muted-foreground"}`}>
                    {d.status}
                  </span>
                </td>
                <td className="px-6 py-3 text-right">
                  <button onClick={async () => { await removeDriver.mutateAsync({ carrierId: id, driverId: d.id! }); refetchDrivers(); }}
                    className="inline-flex items-center gap-1 text-xs text-destructive font-medium opacity-60 hover:opacity-100 transition-opacity">
                    <Trash2 className="w-3.5 h-3.5" /> Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
