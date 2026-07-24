import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRegisterShipper } from "@workspace/api-client-react";
import { ArrowLeft, Loader2, Package } from "lucide-react";

const registerSchema = z.object({
  name: z.string().min(2, "Company name is required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  phone: z.string().min(5, "Phone is required")
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterShipper() {
  const [, setLocation] = useLocation();
  const registerMutation = useRegisterShipper();
  const [errorMsg, setErrorMsg] = useState("");

  const { register, handleSubmit, formState: { errors } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema)
  });

  const onSubmit = async (data: RegisterForm) => {
    setErrorMsg("");
    try {
      await registerMutation.mutateAsync({ data });
      setLocation("/login");
    } catch (err: any) {
      setErrorMsg(err.error?.message || "Registration failed");
    }
  };

  return (
    <div className="min-h-screen bg-secondary flex flex-col py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full mx-auto">
        <Link href="/login" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Login
        </Link>
        
        <div className="bg-card shadow-xl rounded-xl border border-border overflow-hidden">
          <div className="px-8 py-8 border-b border-border bg-sidebar text-sidebar-foreground">
            <div className="w-12 h-12 rounded bg-accent/20 flex items-center justify-center text-accent mb-4">
              <Package className="w-6 h-6" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight">Become a Shipper</h2>
            <p className="text-sidebar-foreground/70 mt-2 text-lg">Coordinate your freight with the Kingdom's best carriers.</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="p-8 space-y-6">
            {errorMsg && (
              <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-md font-medium">
                {errorMsg}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Company Name</label>
                <input {...register("name")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent" />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Phone Number</label>
                <input {...register("phone")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent" />
                {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email Address</label>
                <input type="email" {...register("email")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent" />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Password</label>
                <input type="password" {...register("password")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent" />
                {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
              </div>
            </div>

            <div className="pt-4">
              <button 
                type="submit" 
                disabled={registerMutation.isPending}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-bold text-accent-foreground bg-accent hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent disabled:opacity-50"
              >
                {registerMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Submit Application"}
              </button>
              <p className="text-xs text-center text-muted-foreground mt-4">
                Your account will be reviewed by our operations team before activation.
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
