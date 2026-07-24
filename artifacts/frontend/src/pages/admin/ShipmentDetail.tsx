import { useState } from "react";
import { Link } from "wouter";
import {
  useGetShipment,
  useGetShipmentStatusHistory,
  useGetEligibleCarriers,
  useListVehicles,
  useListDrivers,
  useAssignCarrier,
  useCalculatePricing,
  useSendPricing,
  useCancelShipment,
  useGetWaybill,
} from "@workspace/api-client-react";
import { ArrowLeft, Truck, MapPin, Package, DollarSign, FileText, AlertTriangle } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  requested: "bg-secondary text-secondary-foreground border-border",
  carrier_assigned: "bg-primary/10 text-primary border-primary/20",
  pricing_calculated: "bg-info/10 text-info border-info/20",
  pricing_sent: "bg-accent/10 text-accent border-accent/20",
  pricing_approved: "bg-success/10 text-success border-success/20",
  pricing_rejected: "bg-destructive/10 text-destructive border-destructive/20",
  waybill_issued: "bg-primary/10 text-primary border-primary/20",
  in_transit: "bg-warning/10 text-warning border-warning/20",
  delivered: "bg-success/10 text-success border-success/20",
  cancelled: "bg-muted text-muted-foreground border-border",
};

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      <p className="text-sm font-semibold">{value ?? <span className="text-muted-foreground font-normal">—</span>}</p>
    </div>
  );
}

export function AdminShipmentDetail({ id }: { id: string }) {
  const { data: shipment, isLoading, refetch } = useGetShipment({ shipmentId: id });
  const { data: history } = useGetShipmentStatusHistory({ shipmentId: id });
  const { data: eligibleCarriers } = useGetEligibleCarriers({ shipmentId: id });
  const { data: waybill } = useGetWaybill({ shipmentId: id });

  const [selectedCarrierId, setSelectedCarrierId] = useState("");
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [selectedVehicleId, setSelectedVehicleId] = useState("");

  const { data: driversList } = useListDrivers({ carrierId: selectedCarrierId }, { query: { enabled: !!selectedCarrierId } });
  const { data: vehiclesList } = useListVehicles({ carrierId: selectedCarrierId }, { query: { enabled: !!selectedCarrierId } });

  const assignCarrier = useAssignCarrier();
  const calcPricing = useCalculatePricing();
  const sendPricing = useSendPricing();
  const cancelShipment = useCancelShipment();

  if (isLoading || !shipment) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-6 bg-muted rounded w-24" />
        <div className="grid grid-cols-2 gap-6"><div className="h-48 bg-muted rounded-xl" /><div className="h-48 bg-muted rounded-xl" /></div>
      </div>
    );
  }

  const canAssign = ["requested", "pricing_rejected"].includes(shipment.status);
  const canCalcPricing = shipment.status === "carrier_assigned";
  const canSendPricing = shipment.status === "pricing_calculated";
  const canCancel = !["delivered", "cancelled"].includes(shipment.status);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/shipments" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Shipments
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-bold tracking-tight font-mono">{shipment.reference_number}</h1>
              <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-bold border ${STATUS_COLORS[shipment.status] ?? ""}`}>
                {shipment.status?.replace(/_/g, " ")}
              </span>
            </div>
            <p className="text-muted-foreground text-sm">Created {new Date(shipment.created_at).toLocaleString()}</p>
          </div>
          {canCancel && (
            <button onClick={async () => { await cancelShipment.mutateAsync({ shipmentId: id }); refetch(); }}
              className="inline-flex items-center gap-2 text-sm font-semibold bg-destructive/10 text-destructive border border-destructive/20 px-4 py-2 rounded-lg hover:bg-destructive/20 transition-colors">
              <AlertTriangle className="w-4 h-4" /> Cancel Shipment
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Route */}
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
            <h2 className="font-bold flex items-center gap-2"><MapPin className="w-4 h-4 text-primary" /> Route</h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Pickup" value={shipment.pickup_location} />
              <Field label="Dropoff" value={shipment.dropoff_location} />
              <Field label="Vehicle Type" value={shipment.required_vehicle_type?.replace(/_/g, " ")} />
              <Field label="Vehicle Category" value={shipment.required_vehicle_category?.replace(/_/g, " ")} />
              <Field label="Cargo" value={shipment.cargo_description} />
              <Field label="Distance" value={shipment.distance_km ? `${shipment.distance_km} km` : undefined} />
            </div>
          </div>

          {/* Pricing */}
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
            <h2 className="font-bold flex items-center gap-2"><DollarSign className="w-4 h-4 text-accent" /> Pricing</h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Quoted Price" value={shipment.quoted_price ? `${shipment.quoted_price} ${shipment.currency}` : undefined} />
              <Field label="Currency" value={shipment.currency ?? "SAR"} />
            </div>
            <div className="flex gap-3 pt-2">
              {canCalcPricing && (
                <button onClick={async () => { await calcPricing.mutateAsync({ shipmentId: id }); refetch(); }}
                  className="text-sm font-semibold bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors">
                  Calculate Pricing
                </button>
              )}
              {canSendPricing && (
                <button onClick={async () => { await sendPricing.mutateAsync({ shipmentId: id }); refetch(); }}
                  className="text-sm font-semibold bg-accent text-accent-foreground px-4 py-2 rounded-lg hover:bg-accent/90 transition-colors">
                  Send Pricing to Shipper
                </button>
              )}
            </div>
          </div>

          {/* Carrier Assignment */}
          {canAssign && (
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
              <h2 className="font-bold flex items-center gap-2"><Truck className="w-4 h-4 text-primary" /> Assign Carrier</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Eligible Carrier</label>
                  <select value={selectedCarrierId} onChange={(e) => { setSelectedCarrierId(e.target.value); setSelectedDriverId(""); setSelectedVehicleId(""); }}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20">
                    <option value="">Select a carrier...</option>
                    {(eligibleCarriers ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                {selectedCarrierId && (
                  <>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Driver</label>
                      <select value={selectedDriverId} onChange={(e) => setSelectedDriverId(e.target.value)}
                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20">
                        <option value="">Select driver...</option>
                        {(driversList ?? []).map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Vehicle</label>
                      <select value={selectedVehicleId} onChange={(e) => setSelectedVehicleId(e.target.value)}
                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20">
                        <option value="">Select vehicle...</option>
                        {(vehiclesList ?? []).map((v: any) => <option key={v.id} value={v.id}>{v.plate_number} — {v.vehicle_type}</option>)}
                      </select>
                    </div>
                    <button
                      disabled={!selectedDriverId || !selectedVehicleId}
                      onClick={async () => {
                        await assignCarrier.mutateAsync({ shipmentId: id, data: { carrier_id: selectedCarrierId, driver_id: selectedDriverId, vehicle_id: selectedVehicleId } });
                        refetch();
                      }}
                      className="w-full text-sm font-semibold bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Confirm Assignment
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Waybill */}
          {waybill && (
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-3">
              <h2 className="font-bold flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> Waybill</h2>
              <Field label="Waybill Number" value={waybill.waybill_number} />
              <Field label="Issued" value={new Date(waybill.issued_at).toLocaleString()} />
              <a href={`/api/v1/shipments/${id}/waybill/download`} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm font-semibold bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors">
                <FileText className="w-4 h-4" /> Download PDF
              </a>
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="space-y-4">
          <h2 className="font-bold flex items-center gap-2"><Package className="w-4 h-4 text-primary" /> Status Timeline</h2>
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            {(history ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No status history yet</p>
            ) : (
              <div className="space-y-4">
                {(history as any[]).map((h: any, i: number) => (
                  <div key={h.id} className="relative pl-6">
                    {i < (history as any[]).length - 1 && (
                      <div className="absolute left-[7px] top-5 bottom-0 w-px bg-border" />
                    )}
                    <div className="absolute left-0 top-1 w-3.5 h-3.5 rounded-full bg-primary border-2 border-background ring-2 ring-primary/20" />
                    <p className="text-xs font-bold capitalize text-primary">{h.new_status?.replace(/_/g, " ")}</p>
                    <p className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString()}</p>
                    {h.notes && <p className="text-xs text-muted-foreground italic mt-0.5">{h.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Assigned Resources */}
          {(shipment.carrier_id || shipment.driver_id || shipment.vehicle_id) && (
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-3">
              <h3 className="font-bold text-sm">Assigned Resources</h3>
              {shipment.carrier && <Field label="Carrier" value={(shipment.carrier as any).name} />}
              {shipment.driver && <Field label="Driver" value={(shipment.driver as any).name} />}
              {shipment.vehicle && <Field label="Vehicle" value={`${(shipment.vehicle as any).plate_number} · ${(shipment.vehicle as any).vehicle_type}`} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
