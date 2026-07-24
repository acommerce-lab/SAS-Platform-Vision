import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLogin } from "@workspace/api-client-react";
import { Package, ArrowRight, Loader2 } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const [, setLocation] = useLocation();
  const login = useLogin();
  const [errorMsg, setErrorMsg] = useState("");

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema)
  });

  const onSubmit = async (data: LoginForm) => {
    setErrorMsg("");
    try {
      const res = await login.mutateAsync({ data });
      setLocation(`/${res.role}/dashboard`);
    } catch (err: any) {
      setErrorMsg(err.error?.message || "Invalid credentials");
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-sidebar text-sidebar-foreground p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1586528116311-ad8c7bd740cb?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center opacity-20 mix-blend-overlay"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-sidebar via-sidebar/80 to-transparent"></div>
        
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold shadow-lg">
            S
          </div>
          <span className="font-bold text-2xl tracking-tight">SAS Platform</span>
        </div>

        <div className="relative z-10 max-w-md">
          <h1 className="text-4xl font-bold mb-4 leading-tight">Saudi Arabia's Premier Logistics Engine</h1>
          <p className="text-sidebar-foreground/70 text-lg mb-8">
            Coordinate freight, manage fleets, and track shipments across the Kingdom with precision and reliability.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-sidebar-accent/50 p-4 rounded-lg border border-sidebar-border backdrop-blur-sm">
              <div className="text-3xl font-bold font-mono text-primary mb-1">10k+</div>
              <div className="text-sm text-sidebar-foreground/70">Daily Shipments</div>
            </div>
            <div className="bg-sidebar-accent/50 p-4 rounded-lg border border-sidebar-border backdrop-blur-sm">
              <div className="text-3xl font-bold font-mono text-primary mb-1">99.9%</div>
              <div className="text-sm text-sidebar-foreground/70">Uptime</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex flex-col justify-center px-8 sm:px-16 lg:px-24">
        <div className="w-full max-w-md mx-auto">
          <div className="mb-8">
            <div className="w-12 h-12 rounded bg-primary/10 flex items-center justify-center text-primary mb-6 lg:hidden">
              <Package className="w-6 h-6" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight mb-2">Welcome back</h2>
            <p className="text-muted-foreground">Log in to your operations portal.</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {errorMsg && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-md font-medium">
                {errorMsg}
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none" htmlFor="email">Email</label>
              <input 
                id="email"
                type="email" 
                {...register("email")}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="name@company.com"
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium leading-none" htmlFor="password">Password</label>
                <Link href="/forgot-password" className="text-sm text-primary hover:underline font-medium">
                  Forgot password?
                </Link>
              </div>
              <input 
                id="password"
                type="password" 
                {...register("password")}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>

            <button 
              type="submit" 
              disabled={login.isPending}
              className="inline-flex w-full items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 mt-4"
            >
              {login.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign in to Portal"}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-border">
            <p className="text-sm text-muted-foreground mb-4 text-center">Don't have an account?</p>
            <div className="grid grid-cols-2 gap-4">
              <Link href="/register/carrier" className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 group transition-all hover:border-accent">
                Join as Carrier
                <ArrowRight className="w-4 h-4 ml-2 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
              </Link>
              <Link href="/register/shipper" className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 group transition-all hover:border-accent">
                Join as Shipper
                <ArrowRight className="w-4 h-4 ml-2 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
