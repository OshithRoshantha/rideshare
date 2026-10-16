import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { Car, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import clsx from "clsx";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { api, apiErrorMessage } from "@/lib/api";
import { APP_NAME } from "@/lib/config";
import { type Role, useAuthStore } from "@/stores/auth";

const schema = z.object({
  full_name: z.string().min(2, "Enter your full name"),
  email: z.string().email("Enter a valid email"),
  phone: z.string().min(9, "Enter a valid phone number"),
  password: z.string().min(6, "At least 6 characters"),
});

type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [role, setRole] = useState<Role>("passenger");
  const [loading, setLoading] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setLoading(true);
    try {
      const res = await api.post("/auth/register", { ...values, role });
      setAuth(res.data.access_token, res.data.user);
      toast.success("Account created!");
      navigate(role === "driver" ? "/driver/onboarding" : "/app/home");
    } catch (e) {
      toast.error(apiErrorMessage(e, "Could not create your account"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-10">
      <div className="w-full max-w-sm rounded-card border border-border bg-bg p-7 shadow-soft">
        <Link to="/" className="mb-6 block text-center text-xl font-bold text-accent">
          {APP_NAME}
        </Link>
        <h1 className="mb-1 text-xl font-semibold">Create your account</h1>
        <p className="mb-6 text-sm text-text-secondary">Join your daily commute community.</p>

        <div className="mb-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setRole("passenger")}
            className={clsx(
              "flex flex-col items-center gap-2 rounded-input border p-4 text-sm font-medium transition-colors",
              role === "passenger" ? "border-accent bg-accent-soft text-accent" : "border-border text-text-secondary",
            )}
          >
            <UserIcon className="h-5 w-5" />
            Passenger
          </button>
          <button
            type="button"
            onClick={() => setRole("driver")}
            className={clsx(
              "flex flex-col items-center gap-2 rounded-input border p-4 text-sm font-medium transition-colors",
              role === "driver" ? "border-accent bg-accent-soft text-accent" : "border-border text-text-secondary",
            )}
          >
            <Car className="h-5 w-5" />
            Driver
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Input label="Full name" placeholder="Nimal Perera" {...register("full_name")} error={errors.full_name?.message} />
          <Input label="Email" type="email" placeholder="you@example.com" {...register("email")} error={errors.email?.message} />
          <Input label="Phone" placeholder="+94 77 123 4567" {...register("phone")} error={errors.phone?.message} />
          <Input label="Password" type="password" placeholder="At least 6 characters" {...register("password")} error={errors.password?.message} />
          <Button type="submit" loading={loading} fullWidth>
            Create account
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-text-secondary">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-accent">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
