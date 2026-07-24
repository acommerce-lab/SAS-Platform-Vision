import { useGetDashboardStats } from "@workspace/api-client-react";
import { Package, AlertCircle, Clock, CheckCircle2, Truck, Users } from "lucide-react";
import { Link } from "wouter";

export default function AdminDashboard() {
  const { data: stats, isLoading } = useGetDashboardStats();

  if (isLoading || !stats) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-muted rounded w-1/4"></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1,2,3,4].map(i => <div key={i} className="h-32 bg-muted rounded-xl"></div>)}
        </div>
      </div>
    );
  }

  const { shipments_by_status, pending_activations, total_carriers, total_shippers, recent_shipments } = stats;
  
  const pendingCount = (shipments_by_status["requested"] || 0) + (shipments_by_status["pricing_calculated"] || 0);
  const activeCount = (shipments_by_status["carrier_assigned"] || 0) + (shipments_by_status["in_transit"] || 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Platform Overview</h1>
        <p className="text-muted-foreground mt-1">Real-time metrics for SAS Platform operations.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm relative overflow-hidden group hover:border-primary/50 transition-colors">
          <div className="absolute right-0 top-0 opacity-5 -mt-4 -mr-4 text-primary">
            <Package className="w-32 h-32" />
          </div>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-warning/10 text-warning flex items-center justify-center">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Pending Action</p>
              <h3 className="text-3xl font-bold tabular-nums">{pendingCount}</h3>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-sm relative overflow-hidden group hover:border-primary/50 transition-colors">
          <div className="absolute right-0 top-0 opacity-5 -mt-4 -mr-4 text-primary">
            <Truck className="w-32 h-32" />
          </div>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Active Shipments</p>
              <h3 className="text-3xl font-bold tabular-nums">{activeCount}</h3>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-sm relative overflow-hidden group hover:border-primary/50 transition-colors">
          <div className="absolute right-0 top-0 opacity-5 -mt-4 -mr-4 text-primary">
            <CheckCircle2 className="w-32 h-32" />
          </div>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-success/10 text-success flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Delivered</p>
              <h3 className="text-3xl font-bold tabular-nums">{shipments_by_status["delivered"] || 0}</h3>
            </div>
          </div>
        </div>

        <div className="bg-card border border-destructive/30 rounded-xl p-6 shadow-sm relative overflow-hidden hover:border-destructive/60 transition-colors">
          <div className="absolute right-0 top-0 opacity-5 -mt-4 -mr-4 text-destructive">
            <AlertCircle className="w-32 h-32" />
          </div>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-destructive/80 uppercase tracking-wider">Pending Approvals</p>
              <h3 className="text-3xl font-bold text-destructive tabular-nums">
                {pending_activations.carriers + pending_activations.shippers}
              </h3>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            {pending_activations.carriers > 0 && (
              <Link href="/admin/carriers?status=pending_activation" className="text-xs font-medium bg-destructive/10 text-destructive px-2 py-1 rounded-md hover:bg-destructive/20">
                {pending_activations.carriers} Carriers
              </Link>
            )}
            {pending_activations.shippers > 0 && (
              <Link href="/admin/shippers?status=pending_activation" className="text-xs font-medium bg-destructive/10 text-destructive px-2 py-1 rounded-md hover:bg-destructive/20">
                {pending_activations.shippers} Shippers
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight">Recent Shipments</h2>
            <Link href="/admin/shipments" className="text-sm font-medium text-primary hover:underline">View all</Link>
          </div>
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground bg-secondary/50 uppercase">
                <tr>
                  <th className="px-4 py-3 font-medium">Ref</th>
                  <th className="px-4 py-3 font-medium">Route</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Vehicle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recent_shipments.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No recent shipments</td>
                  </tr>
                ) : recent_shipments.map(shipment => (
                  <tr key={shipment.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-primary">
                      <Link href={`/admin/shipments/${shipment.id}`}>{shipment.reference_number}</Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="max-w-[200px] truncate">{shipment.pickup_location} → {shipment.dropoff_location}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-secondary text-secondary-foreground">
                        {shipment.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground capitalize">
                      {shipment.required_vehicle_type}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-bold tracking-tight">Network Health</h2>
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">Total Carriers</span>
                <span className="text-xl font-bold tabular-nums">{total_carriers}</span>
              </div>
              <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                <div className="bg-primary h-full rounded-full" style={{ width: '70%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">Total Shippers</span>
                <span className="text-xl font-bold tabular-nums">{total_shippers}</span>
              </div>
              <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                <div className="bg-accent h-full rounded-full" style={{ width: '40%' }}></div>
              </div>
            </div>
            
            <div className="pt-6 border-t border-border mt-6">
              <Link href="/admin/carriers" className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-primary/10 text-primary flex items-center justify-center">
                    <Truck className="w-4 h-4" />
                  </div>
                  <span className="font-medium text-sm">Manage Carriers</span>
                </div>
                <span className="text-muted-foreground group-hover:text-primary transition-colors">→</span>
              </Link>
              <Link href="/admin/shippers" className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary transition-colors group mt-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-accent/10 text-accent flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                  <span className="font-medium text-sm">Manage Shippers</span>
                </div>
                <span className="text-muted-foreground group-hover:text-accent transition-colors">→</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
