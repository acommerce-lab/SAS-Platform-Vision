import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  useListCarriers,
  useActivateCarrier,
  useDisableCarrier,
} from "@workspace/api-client-react";
import { Truck, Search, CheckCircle2, XCircle, ChevronRight, Clock } from "lucide-react";

const STATUS_OPTIONS = ["all", "pending_activation", "active", "disabled"];

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-success/10 text-success border-success/20",
    pending_activation: "bg-warning/10 text-warning border-warning/20",
    disabled: "bg-destructive/10 text-destructive border-destructive/20",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${map[status] ?? "bg-secondary text-secondary-foreground border-border"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function AdminCarriers() {
  const [searchParams] = useLocation();
  const urlStatus = new URLSearchParams(searchParams.split("?")[1] || "").get("status") ?? "all";
  const [filter, setFilter] = useState(urlStatus);
  const [search, setSearch] = useState("");

  const { data, isLoading, refetch } = useListCarriers({
    status: filter === "all" ? undefined : filter,
  });

  const activate = useActivateCarrier();
  const disable = useDisableCarrier();

  const carriers = (data?.data ?? []).filter((c) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Carriers</h1>
        <p className="text-muted-foreground mt-1">Manage carrier registrations and fleet status.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search carriers..."
            className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>
        <div className="flex gap-1 bg-secondary/50 p-1 rounded-lg border border-border">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition-all ${filter === s ? "bg-background shadow text-foreground border border-border" : "text-muted-foreground hover:text-foreground"}`}
            >
              {s.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-border">
            {[1,2,3,4].map(i => (
              <div key={i} className="px-6 py-4 animate-pulse flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-muted" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-muted rounded w-1/4" />
                  <div className="h-3 bg-muted rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : carriers.length === 0 ? (
          <div className="px-6 py-16 text-center text-muted-foreground">
            <Truck className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No carriers found</p>
          </div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground bg-secondary/50 uppercase border-b border-border">
              <tr>
                <th className="px-6 py-3 font-medium">Carrier</th>
                <th className="px-6 py-3 font-medium">Contact</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Registered</th>
                <th className="px-6 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {carriers.map((carrier) => (
                <tr key={carrier.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-sm flex-shrink-0">
                        {carrier.name.charAt(0)}
                      </div>
                      <div>
                        <Link href={`/admin/carriers/${carrier.id}`} className="font-semibold hover:text-primary transition-colors">
                          {carrier.name}
                        </Link>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    <div>{carrier.email}</div>
                    {carrier.phone && <div className="text-xs mt-0.5">{carrier.phone}</div>}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={carrier.status} />
                  </td>
                  <td className="px-6 py-4 text-muted-foreground text-xs font-mono">
                    {new Date(carrier.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {carrier.status === "pending_activation" && (
                        <button
                          onClick={async () => { await activate.mutateAsync({ carrierId: carrier.id }); refetch(); }}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold bg-success/10 text-success border border-success/20 px-2.5 py-1.5 rounded-md hover:bg-success/20 transition-colors"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Activate
                        </button>
                      )}
                      {carrier.status === "active" && (
                        <button
                          onClick={async () => { await disable.mutateAsync({ carrierId: carrier.id }); refetch(); }}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold bg-destructive/10 text-destructive border border-destructive/20 px-2.5 py-1.5 rounded-md hover:bg-destructive/20 transition-colors"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Disable
                        </button>
                      )}
                      {carrier.status === "disabled" && (
                        <button
                          onClick={async () => { await activate.mutateAsync({ carrierId: carrier.id }); refetch(); }}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold bg-secondary text-muted-foreground border border-border px-2.5 py-1.5 rounded-md hover:bg-secondary/80 transition-colors"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          Reactivate
                        </button>
                      )}
                      <Link
                        href={`/admin/carriers/${carrier.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold bg-background border border-border px-2.5 py-1.5 rounded-md hover:bg-secondary transition-colors"
                      >
                        View <ChevronRight className="w-3.5 h-3.5" />
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
