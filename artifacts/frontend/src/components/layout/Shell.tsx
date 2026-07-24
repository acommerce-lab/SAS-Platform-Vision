import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useGetCurrentUser, useLogout } from "@workspace/api-client-react";
import { 
  Package, 
  Truck, 
  Users, 
  Bell, 
  LogOut, 
  Menu, 
  Search,
  LayoutDashboard,
  ShieldAlert,
  MessageSquare,
  LifeBuoy
} from "lucide-react";

export function Sidebar() {
  const [location, setLocation] = useLocation();
  const { data: user } = useGetCurrentUser();
  const logout = useLogout();

  const handleLogout = async () => {
    await logout.mutateAsync();
    setLocation("/login");
  };

  if (!user) return null;

  const isAdmin = user.role === "admin";
  const isCarrier = user.role === "carrier";
  const isShipper = user.role === "shipper";

  const navItems = [
    // Admin
    ...(isAdmin ? [
      { icon: LayoutDashboard, label: "Dashboard", href: "/admin/dashboard" },
      { icon: Package, label: "Shipments", href: "/admin/shipments" },
      { icon: Truck, label: "Carriers", href: "/admin/carriers" },
      { icon: Users, label: "Shippers", href: "/admin/shippers" },
    ] : []),
    
    // Carrier
    ...(isCarrier ? [
      { icon: LayoutDashboard, label: "Dashboard", href: "/carrier/dashboard" },
      { icon: Package, label: "My Shipments", href: "/carrier/shipments" },
      { icon: Truck, label: "Vehicles", href: "/carrier/vehicles" },
      { icon: Users, label: "Drivers", href: "/carrier/drivers" },
    ] : []),

    // Shipper
    ...(isShipper ? [
      { icon: LayoutDashboard, label: "Dashboard", href: "/shipper/dashboard" },
      { icon: Package, label: "Shipments", href: "/shipper/shipments" },
      { icon: Users, label: "Customers", href: "/shipper/customers" },
      { icon: Package, label: "Products", href: "/shipper/products" },
    ] : []),

    // Shared
    { icon: Bell, label: "Notifications", href: "/notifications" },
    { icon: MessageSquare, label: "Conversations", href: "/conversations" },
    { icon: LifeBuoy, label: "Support", href: "/support" },
  ];

  return (
    <div className="w-64 bg-sidebar text-sidebar-foreground h-screen flex flex-col fixed left-0 top-0 border-r border-sidebar-border z-20">
      <div className="h-16 flex items-center px-6 border-b border-sidebar-border gap-3">
        <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold shadow-sm">
          S
        </div>
        <span className="font-bold text-lg tracking-tight">SAS Platform</span>
      </div>
      
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        <div className="text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider mb-2 px-3">
          {user.role} Portal
        </div>
        {navItems.map((item) => {
          const active = location.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium ${
                active 
                  ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              }`}
            >
              <item.icon className={`w-4 h-4 ${active ? "text-primary" : ""}`} />
              {item.label}
            </Link>
          );
        })}
      </div>

      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 mb-4 px-2">
          <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center text-xs font-bold">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user.name}</p>
            <p className="text-xs text-sidebar-foreground/50 truncate">{user.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm font-medium text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Log out
        </button>
      </div>
    </div>
  );
}

export function Topbar() {
  const { data: user } = useGetCurrentUser();
  if (!user) return null;

  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 sticky top-0 z-10">
      <div className="flex items-center gap-4">
        <div className="relative max-w-md hidden md:block">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Search shipments, carriers..." 
            className="h-9 w-64 rounded-md border border-border bg-background pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>
      </div>
      <div className="flex items-center gap-4">
        {user.status === "pending_activation" && (
          <div className="flex items-center gap-2 text-xs font-medium bg-warning/10 text-warning-foreground px-3 py-1.5 rounded-full border border-warning/20">
            <ShieldAlert className="w-3.5 h-3.5" />
            Account Pending Activation
          </div>
        )}
        <button className="relative p-2 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-secondary">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-destructive border-2 border-card"></span>
        </button>
      </div>
    </header>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 p-6 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
