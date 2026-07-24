import { Link } from "wouter";
import {
  useGetShipment,
  useGetShipmentStatusHistory,
  useApprovePricing,
  useRejectPricing,
  useGetWaybill,
} from "@workspace/api-client-react";
import { ArrowLeft, MapPin, DollarSign, FileText, CheckCircle2, XCircle } from "lucide-react";

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      <p className="text-sm font-semibold">{value ?? <span className="text-muted-foreground font-normal">—</span>}</p>
    </div>
  );
}

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

export function ShipperShipmentDetail({ id }: { id: string }) {
  const { data: shipment, isLoading, refetch } = useGetShipment({ shipmentId: id });
  const { data: history } = useGetShipmentStatusHistory({ shipmentId: id });
  const { data: waybill } = useGetWaybill({ shipmentId: id });
  const approvePricing = useApprovePricing();
  const rejectPricing = useRejectPricing();

  if (isLoading || !shipment) {
    return <div className="space-y-6 animate-pulse"><div className="h-6 bg-muted rounded w-24" /><div className="h-48 bg-muted rounded-xl" /></div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <Link href="/shipper/shipments" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Shipments
        </Link>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-3xl font-bold tracking-tight font-mono">{shipment.reference_number}</h1>
          <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-bold border ${STATUS_COLORS[shipment.status] ?? ""}`}>
            {shipment.status?.replace(/_/g, " ")}
          </span>
        </div>
        <p className="text-muted-foreground text-sm">Created {new Date(shipment.created_at).toLocaleString()}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
            <h2 className="font-bold flex items-center gap-2"><MapPin className="w-4 h-4 text-primary" /> Route</h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Pickup" value={shipment.pickup_location} />
              <Field label="Dropoff" value={shipment.dropoff_location} />
              <Field label="Cargo" value={shipment.cargo_description} />
              <Field label="Distance" value={shipment.distance_km ? `${shipment.distance_km} km` : undefined} />
              <Field label="Vehicle Type" value={shipment.required_vehicle_type?.replace(/_/g, " ")} />
              <Field label="Category" value={shipment.required_vehicle_category?.replace(/_/g, " ")} />
            </div>
          </div>

          {/* Pricing */}
          {shipment.quoted_price && (
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
              <h2 className="font-bold flex items-center gap-2"><DollarSign className="w-4 h-4 text-accent" /> Pricing Quote</h2>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-bold font-mono tabular-nums text-accent">{shipment.quoted_price}</span>
                <span className="text-xl font-bold text-accent mb-0.5">SAR</span>
              </div>
              {shipment.distance_km && (
                <p className="text-sm text-muted-foreground">{shipment.distance_km} km · rate based on vehicle category</p>
              )}
              {shipment.status === "pricing_sent" && (
                <div className="flex gap-3 pt-2">
                  <button onClick={async () => { await approvePricing.mutateAsync({ shipmentId: id }); refetch(); }}
                    className="inline-flex items-center gap-2 bg-success text-white px-6 py-2.5 rounded-lg text-sm font-bold hover:bg-success/90 transition-colors">
                    <CheckCircle2 className="w-4 h-4" /> Approve Pricing
                  </button>
                  <button onClick={async () => { await rejectPricing.mutateAsync({ shipmentId: id }); refetch(); }}
                    className="inline-flex items-center gap-2 bg-destructive/10 text-destructive border border-destructive/20 px-6 py-2.5 rounded-lg text-sm font-bold hover:bg-destructive/20 transition-colors">
                    <XCircle className="w-4 h-4" /> Reject Pricing
                  </button>
                </div>
              )}
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
          <h2 className="font-bold">Status Timeline</h2>
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            {(history ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No history yet</p>
            ) : (
              <div className="space-y-4">
                {(history as any[]).map((h: any, i: number) => (
                  <div key={h.id} className="relative pl-6">
                    {i < (history as any[]).length - 1 && <div className="absolute left-[7px] top-5 bottom-0 w-px bg-border" />}
                    <div className="absolute left-0 top-1 w-3.5 h-3.5 rounded-full bg-primary border-2 border-background ring-2 ring-primary/20" />
                    <p className="text-xs font-bold capitalize text-primary">{h.new_status?.replace(/_/g, " ")}</p>
                    <p className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString()}</p>
                    {h.notes && <p className="text-xs text-muted-foreground italic mt-0.5">{h.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
