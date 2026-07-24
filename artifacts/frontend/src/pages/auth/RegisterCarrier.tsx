import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRegisterCarrier } from "@workspace/api-client-react";
import { ArrowLeft, Loader2, Plus, Trash2, Truck } from "lucide-react";

const vehicleSchema = z.object({
  vehicle_type: z.enum(["flatbed", "refrigerated", "cage", "tow_truck", "curtain_side", "container", "low_bed", "other"]),
  vehicle_category: z.enum(["dyna", "single_truck", "trailer", "semi_trailer", "road_train", "other"]),
  plate_number: z.string().min(1, "Plate number is required")
});

const registerSchema = z.object({
  name: z.string().min(2, "Company name is required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  phone: z.string().min(5, "Phone is required"),
  vehicles: z.array(vehicleSchema).min(1, "At least one vehicle is required")
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterCarrier() {
  const [, setLocation] = useLocation();
  const registerMutation = useRegisterCarrier();
  const [errorMsg, setErrorMsg] = useState("");

  const { register, control, handleSubmit, formState: { errors } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      vehicles: [{ vehicle_type: "flatbed", vehicle_category: "trailer", plate_number: "" }]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "vehicles"
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
      <div className="max-w-2xl w-full mx-auto">
        <Link href="/login" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Login
        </Link>
        
        <div className="bg-card shadow-xl rounded-xl border border-border overflow-hidden">
          <div className="px-8 py-8 border-b border-border bg-sidebar text-sidebar-foreground">
            <div className="w-12 h-12 rounded bg-primary/20 flex items-center justify-center text-primary mb-4">
              <Truck className="w-6 h-6" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight">Become a Carrier</h2>
            <p className="text-sidebar-foreground/70 mt-2 text-lg">Join SAS Platform to manage your fleet and find loads.</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="p-8 space-y-8">
            {errorMsg && (
              <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-md font-medium">
                {errorMsg}
              </div>
            )}

            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b border-border pb-2">Company Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Company Name</label>
                  <input {...register("name")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary" />
                  {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Phone</label>
                  <input {...register("phone")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary" />
                  {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <input type="email" {...register("email")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary" />
                  {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Password</label>
                  <input type="password" {...register("password")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary" />
                  {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <h3 className="text-lg font-semibold">Fleet Registration</h3>
                <span className="text-xs text-muted-foreground">Add at least one vehicle</span>
              </div>
              
              <div className="space-y-4">
                {fields.map((field, index) => (
                  <div key={field.id} className="p-4 border border-border rounded-lg bg-secondary/30 relative group">
                    {index > 0 && (
                      <button 
                        type="button" 
                        onClick={() => remove(index)}
                        className="absolute -right-2 -top-2 w-8 h-8 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-sm hover:scale-110 transition-transform"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</label>
                        <select {...register(`vehicles.${index}.vehicle_type`)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                          <option value="flatbed">Flatbed</option>
                          <option value="refrigerated">Refrigerated</option>
                          <option value="curtain_side">Curtain Side</option>
                          <option value="tow_truck">Tow Truck</option>
                          <option value="cage">Cage</option>
                          <option value="container">Container</option>
                          <option value="low_bed">Low Bed</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Category</label>
                        <select {...register(`vehicles.${index}.vehicle_category`)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                          <option value="trailer">Trailer</option>
                          <option value="single_truck">Single Truck</option>
                          <option value="dyna">Dyna</option>
                          <option value="semi_trailer">Semi Trailer</option>
                          <option value="road_train">Road Train</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Plate Number</label>
                        <input {...register(`vehicles.${index}.plate_number`)} placeholder="e.g. ABC 1234" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-primary/50" />
                        {errors.vehicles?.[index]?.plate_number && <p className="text-xs text-destructive">{errors.vehicles[index].plate_number?.message}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <button 
                type="button" 
                onClick={() => append({ vehicle_type: "flatbed", vehicle_category: "trailer", plate_number: "" })}
                className="inline-flex items-center text-sm font-medium text-primary hover:text-primary/80 transition-colors"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Another Vehicle
              </button>
            </div>

            <div className="pt-4">
              <button 
                type="submit" 
                disabled={registerMutation.isPending}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-bold text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
              >
                {registerMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Submit Carrier Application"}
              </button>
              <p className="text-xs text-center text-muted-foreground mt-4">
                By registering, you agree to our Carrier Service Terms and acknowledge that your account requires administrator approval before you can access the portal.
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
