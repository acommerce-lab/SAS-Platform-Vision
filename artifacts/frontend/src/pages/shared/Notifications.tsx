import { useListNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from "@workspace/api-client-react";
import { Bell, CheckCheck, Package } from "lucide-react";

export default function Notifications() {
  const { data, isLoading, refetch } = useListNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const notifications = data?.data ?? [];
  const unreadCount = data?.unread_count ?? 0;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground mt-1">
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={async () => { await markAllRead.mutateAsync(); refetch(); }}
            className="inline-flex items-center gap-2 text-sm font-semibold bg-secondary border border-border px-4 py-2 rounded-lg hover:bg-secondary/80 transition-colors"
          >
            <CheckCheck className="w-4 h-4" /> Mark all read
          </button>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-border">
            {[1,2,3,4].map(i => (
              <div key={i} className="px-6 py-4 animate-pulse flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-muted flex-shrink-0" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-muted rounded w-1/3" />
                  <div className="h-3 bg-muted rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="px-6 py-16 text-center text-muted-foreground">
            <Bell className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No notifications yet</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {notifications.map((n: any) => (
              <div
                key={n.id}
                className={`px-6 py-4 flex items-start gap-4 transition-colors ${!n.is_read ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/30"}`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${!n.is_read ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}>
                  <Bell className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-semibold ${!n.is_read ? "text-foreground" : "text-muted-foreground"}`}>{n.title}</p>
                    {!n.is_read && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{n.message}</p>
                  <p className="text-xs text-muted-foreground/60 mt-1 font-mono">{new Date(n.created_at).toLocaleString()}</p>
                </div>
                {!n.is_read && (
                  <button
                    onClick={async () => { await markRead.mutateAsync({ notificationId: n.id }); refetch(); }}
                    className="text-xs font-semibold text-muted-foreground hover:text-primary transition-colors flex-shrink-0"
                  >
                    Mark read
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
