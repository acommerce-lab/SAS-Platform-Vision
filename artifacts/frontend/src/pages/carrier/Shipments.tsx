import { useState } from "react";
import { Link } from "wouter";
import { useListShipments, useStartShipment, useDeliverShipment } from "@workspace/api-client-react";
import { Package, Truck, CheckCircle2 } from "lucide-react";

const STATUS_OPTIONS = ["all", "waybill_issued", "in_transit", "delivered", "cancelled"];

const STATUS_COLORS: Record<string, string> = {
  waybill_issued: "bg-primary/10 text-primary border-primary/20",
  in_transit: "bg-warning/10 text-warning border-warning/20",
  delivered: "bg-success/10 text-success border-success/20",
  cancelled: "bg-muted text-muted-foreground border-border",
};

export function CarrierShipments() {
  const [filter, setFilter] = useState("all");
  const { data, isLoading, refetch } = useListShipments({ status: filter === "all" ? undefined : filter });
  const startShipment = useStartShipment();
  const deliverShipment = useDeliverShipment();

  const shipments = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Shipments</h1>
        <p className="text-muted-foreground mt-1">Manage loads assigned to your fleet.</p>
      </div>

      <div className="flex gap-1 bg-secondary/50 p-1 rounded-lg border border-border w-fit">
        {STATUS_OPTIONS.map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition-all ${filter === s ? "bg-background shadow text-foreground border border-border" : "text-muted-foreground hover:text-foreground"}`}>
            {s.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-border">
            {[1,2,3].map(i => (
              <div key={i} className="px-6 py-4 animate-pulse flex gap-4">
                <div className="h-4 bg-muted rounded w-32" /><div className="h-4 bg-muted rounded flex-1" />
              </div>
            ))}
          </div>
        ) : shipments.length === 0 ? (
          <div className="px-6 py-16 text-center text-muted-foreground">
            <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No shipments in this status</p>
          </div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground bg-secondary/50 uppercase border-b border-border">
              <tr>
                <th className="px-6 py-3 font-medium">Reference</th>
                <th className="px-6 py-3 font-medium">Route</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shipments.map((s) => (
                <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-3 font-mono font-semibold text-primary">
                    <Link href={`/carrier/shipments/${s.id}`}>{s.reference_number}</Link>
                  </td>
                  <td className="px-6 py-3">
                    <div className="font-medium truncate max-w-xs">{s.pickup_location}</div>
                    <div className="text-muted-foreground text-xs truncate max-w-xs">↓ {s.dropoff_location}</div>
                  </td>
                  <td className="px-6 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-semibold border ${STATUS_COLORS[s.status] ?? "bg-secondary text-secondary-foreground border-border"}`}>
                      {s.status?.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {s.status === "waybill_issued" && (
                        <button onClick={async () => { await startShipment.mutateAsync({ shipmentId: s.id }); refetch(); }}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold bg-warning/10 text-warning border border-warning/20 px-3 py-1.5 rounded-md hover:bg-warning/20 transition-colors">
                          <Truck className="w-3.5 h-3.5" /> Start Transit
                        </button>
                      )}
                      {s.status === "in_transit" && (
                        <button onClick={async () => { await deliverShipment.mutateAsync({ shipmentId: s.id }); refetch(); }}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold bg-success/10 text-success border border-success/20 px-3 py-1.5 rounded-md hover:bg-success/20 transition-colors">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Mark Delivered
                        </button>
                      )}
                      <Link href={`/carrier/shipments/${s.id}`}
                        className="text-xs font-semibold bg-background border border-border px-2.5 py-1.5 rounded-md hover:bg-secondary transition-colors">
                        Detail
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
