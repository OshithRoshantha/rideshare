import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { api, apiErrorMessage } from "@/lib/api";
import { APP_NAME, IS_DEV } from "@/lib/config";
import { type Role, useAuthStore } from "@/stores/auth";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type FormValues = z.infer<typeof schema>;

const DEMO_ACCOUNTS = [
  { label: "Admin", email: "admin@demo.lk", password: "Admin@123" },
  { label: "Driver (approved)", email: "driver1@demo.lk", password: "Driver@123" },
  { label: "Passenger", email: "passenger1@demo.lk", password: "Pass@123" },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const roleHome: Record<Role, string> = {
    passenger: "/app/home",
    driver: "/driver/today",
    admin: "/admin/dashboard",
  };

  async function doLogin(values: FormValues) {
    setLoading(true);
    try {
      const res = await api.post("/auth/login", values);
      setAuth(res.data.access_token, res.data.user);
      toast.success(`Welcome back, ${res.data.user.full_name.split(" ")[0]}!`);
      navigate(roleHome[res.data.user.role as Role]);
    } catch (e) {
      toast.error(apiErrorMessage(e, "Invalid email or password"));
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
        <h1 className="mb-1 text-xl font-semibold">Welcome back</h1>
        <p className="mb-6 text-sm text-text-secondary">Log in to book your daily commute.</p>

        <form onSubmit={handleSubmit(doLogin)} className="flex flex-col gap-4">
          <Input label="Email" type="email" placeholder="you@example.com" {...register("email")} error={errors.email?.message} />
          <div className="relative">
            <Input
              label="Password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              {...register("password")}
              error={errors.password?.message}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-[38px] text-text-muted"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <Button type="submit" loading={loading} fullWidth>
            Log in
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-text-secondary">
          New here?{" "}
          <Link to="/register" className="font-medium text-accent">
            Create an account
          </Link>
        </p>

        {IS_DEV && (
          <div className="mt-6 rounded-input bg-surface p-3">
            <p className="mb-2 text-xs font-medium text-text-secondary">Dev quick login</p>
            <div className="flex flex-wrap gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  className="rounded-full border border-border bg-bg px-3 py-1 text-xs hover:bg-surface"
                  onClick={() => {
                    setValue("email", acc.email);
                    setValue("password", acc.password);
                    doLogin(acc);
                  }}
                >
                  {acc.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
