import { ReactNode } from "react";
import { useLocation } from "wouter";
import { useGetCurrentUser } from "@workspace/api-client-react";
import { Loader2 } from "lucide-react";

export function AuthGuard({ children, requireRole }: { children: ReactNode, requireRole?: string }) {
  const [, setLocation] = useLocation();
  const { data: user, isLoading, isError } = useGetCurrentUser({ 
    query: {
      retry: false
    }
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !user) {
    // If not authenticated, redirect to login (run after render)
    setTimeout(() => setLocation("/login"), 0);
    return null;
  }

  if (requireRole && user.role !== requireRole) {
    // If wrong role, redirect to their proper dashboard
    setTimeout(() => setLocation(`/${user.role}/dashboard`), 0);
    return null;
  }

  return <>{children}</>;
}
