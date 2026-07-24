import { useState } from "react";
import { Link } from "wouter";
import { useListShipments } from "@workspace/api-client-react";
import { Package, Search, Filter } from "lucide-react";

const STATUS_OPTIONS = [
  "all", "requested", "carrier_assigned", "pricing_calculated",
  "pricing_sent", "pricing_approved", "pricing_rejected",
  "waybill_issued", "in_transit", "delivered", "cancelled",
];

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

export function AdminShipments() {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useListShipments({ status: filter === "all" ? undefined : filter });

  const shipments = (data?.data ?? []).filter((s) =>
    !search ||
    s.reference_number?.toLowerCase().includes(search.toLowerCase()) ||
    s.pickup_location?.toLowerCase().includes(search.toLowerCase()) ||
    s.dropoff_location?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">All Shipments</h1>
        <p className="text-muted-foreground mt-1">Manage the full shipment lifecycle across the platform.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by ref, pickup, dropoff..."
            className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select value={filter} onChange={(e) => setFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20">
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace(/_/g, " ") || "All"}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-border">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="px-6 py-4 animate-pulse flex gap-4">
                <div className="h-4 bg-muted rounded w-32" />
                <div className="h-4 bg-muted rounded flex-1" />
                <div className="h-4 bg-muted rounded w-24" />
              </div>
            ))}
          </div>
        ) : shipments.length === 0 ? (
          <div className="px-6 py-16 text-center text-muted-foreground">
            <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No shipments found</p>
          </div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground bg-secondary/50 uppercase border-b border-border">
              <tr>
                <th className="px-6 py-3 font-medium">Reference</th>
                <th className="px-6 py-3 font-medium">Route</th>
                <th className="px-6 py-3 font-medium">Vehicle</th>
                <th className="px-6 py-3 font-medium">Quote</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shipments.map((s) => (
                <tr key={s.id} className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => window.location.href = `/admin/shipments/${s.id}`}>
                  <td className="px-6 py-3 font-mono font-semibold text-primary">
                    <Link href={`/admin/shipments/${s.id}`} onClick={(e) => e.stopPropagation()}>{s.reference_number}</Link>
                  </td>
                  <td className="px-6 py-3 max-w-xs">
                    <div className="truncate font-medium">{s.pickup_location}</div>
                    <div className="truncate text-muted-foreground text-xs mt-0.5">↓ {s.dropoff_location}</div>
                  </td>
                  <td className="px-6 py-3 text-muted-foreground capitalize text-xs">
                    {s.required_vehicle_type?.replace(/_/g, " ")}<br />
                    <span className="text-muted-foreground/60">{s.required_vehicle_category?.replace(/_/g, " ")}</span>
                  </td>
                  <td className="px-6 py-3 font-mono text-sm">
                    {s.quoted_price ? `${s.quoted_price} SAR` : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-6 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-semibold border ${STATUS_COLORS[s.status] ?? "bg-secondary text-secondary-foreground border-border"}`}>
                      {s.status?.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-muted-foreground text-xs font-mono">
                    {new Date(s.created_at).toLocaleDateString()}
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
