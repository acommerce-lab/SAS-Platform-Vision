import { useGetDashboardStats } from "@workspace/api-client-react";
import { Package, Truck, Navigation, CheckCircle2, Clock } from "lucide-react";
import { Link } from "wouter";

export default function CarrierDashboard() {
  const { data: stats, isLoading } = useGetDashboardStats();

  if (isLoading || !stats) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-muted rounded w-1/4"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1,2,3].map(i => <div key={i} className="h-32 bg-muted rounded-xl"></div>)}
        </div>
      </div>
    );
  }

  const { shipments_by_status, recent_shipments } = stats;
  
  const assignedCount = shipments_by_status["carrier_assigned"] || 0;
  const transitCount = shipments_by_status["in_transit"] || 0;
  const deliveredCount = shipments_by_status["delivered"] || 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Carrier Overview</h1>
        <p className="text-muted-foreground mt-1">Manage your assigned loads and fleet activity.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm relative overflow-hidden group hover:border-warning/50 transition-colors">
          <div className="absolute right-0 top-0 opacity-5 -mt-4 -mr-4 text-warning">
            <Clock className="w-32 h-32" />
          </div>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-warning/10 text-warning flex items-center justify-center">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Assigned / Ready</p>
              <h3 className="text-3xl font-bold tabular-nums">{assignedCount}</h3>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-sm relative overflow-hidden group hover:border-primary/50 transition-colors">
          <div className="absolute right-0 top-0 opacity-5 -mt-4 -mr-4 text-primary">
            <Navigation className="w-32 h-32" />
          </div>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">In Transit</p>
              <h3 className="text-3xl font-bold tabular-nums">{transitCount}</h3>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-sm relative overflow-hidden group hover:border-success/50 transition-colors">
          <div className="absolute right-0 top-0 opacity-5 -mt-4 -mr-4 text-success">
            <CheckCircle2 className="w-32 h-32" />
          </div>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-success/10 text-success flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Delivered</p>
              <h3 className="text-3xl font-bold tabular-nums">{deliveredCount}</h3>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight">Active Shipments</h2>
          <Link href="/carrier/shipments" className="text-sm font-medium text-primary hover:underline">View all</Link>
        </div>
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground bg-secondary/50 uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">Ref</th>
                <th className="px-4 py-3 font-medium">Route</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recent_shipments.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No active shipments</td>
                </tr>
              ) : recent_shipments.map(shipment => (
                <tr key={shipment.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-3 font-mono font-medium text-primary">
                    <Link href={`/carrier/shipments/${shipment.id}`}>{shipment.reference_number}</Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="max-w-[300px] truncate font-medium">{shipment.pickup_location}</div>
                    <div className="max-w-[300px] truncate text-muted-foreground mt-0.5">↓ {shipment.dropoff_location}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-secondary text-secondary-foreground border border-border">
                      {shipment.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/carrier/shipments/${shipment.id}`} className="text-sm font-medium bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:bg-primary/90 transition-colors">
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
