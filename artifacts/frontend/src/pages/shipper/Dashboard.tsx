import { useGetDashboardStats } from "@workspace/api-client-react";
import { Package, Truck, DollarSign, Clock, Plus } from "lucide-react";
import { Link } from "wouter";

export default function ShipperDashboard() {
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
  
  const quotingCount = shipments_by_status["pricing_sent"] || 0;
  const activeCount = (shipments_by_status["carrier_assigned"] || 0) + (shipments_by_status["in_transit"] || 0) + (shipments_by_status["waybill_issued"] || 0);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Shipper Overview</h1>
          <p className="text-muted-foreground mt-1">Track your freight and review pricing quotes.</p>
        </div>
        <Link 
          href="/shipper/shipments/new" 
          className="flex items-center gap-2 bg-accent text-accent-foreground px-4 py-2 rounded-lg font-bold hover:bg-accent/90 transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5" />
          New Shipment
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm relative overflow-hidden group hover:border-accent/50 transition-colors">
          <div className="absolute right-0 top-0 opacity-5 -mt-4 -mr-4 text-accent">
            <DollarSign className="w-32 h-32" />
          </div>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-accent/10 text-accent flex items-center justify-center">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Pending Quotes</p>
              <h3 className="text-3xl font-bold tabular-nums">{quotingCount}</h3>
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
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Active Freight</p>
              <h3 className="text-3xl font-bold tabular-nums">{activeCount}</h3>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-sm relative overflow-hidden">
          <div className="absolute right-0 top-0 opacity-5 -mt-4 -mr-4 text-muted-foreground">
            <Clock className="w-32 h-32" />
          </div>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-secondary text-secondary-foreground flex items-center justify-center">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Requested</p>
              <h3 className="text-3xl font-bold tabular-nums">{shipments_by_status["requested"] || 0}</h3>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight">Recent Activity</h2>
          <Link href="/shipper/shipments" className="text-sm font-medium text-primary hover:underline">View all shipments</Link>
        </div>
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground bg-secondary/50 uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">Ref</th>
                <th className="px-4 py-3 font-medium">Route</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Quote</th>
                <th className="px-4 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recent_shipments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No recent shipments</td>
                </tr>
              ) : recent_shipments.map(shipment => (
                <tr key={shipment.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-3 font-mono font-medium text-primary">
                    <Link href={`/shipper/shipments/${shipment.id}`}>{shipment.reference_number}</Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="max-w-[250px] truncate">{shipment.pickup_location} → {shipment.dropoff_location}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${
                      shipment.status === 'pricing_sent' ? 'bg-accent/10 text-accent border-accent/20' :
                      shipment.status === 'in_transit' ? 'bg-primary/10 text-primary border-primary/20' :
                      'bg-secondary text-secondary-foreground border-border'
                    }`}>
                      {shipment.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono">
                    {shipment.quoted_price ? `${shipment.quoted_price} SAR` : '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/shipper/shipments/${shipment.id}`} className="text-sm font-medium hover:underline text-primary">
                      View
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
