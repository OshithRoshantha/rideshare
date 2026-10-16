import { type ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { type Role, useAuthStore } from "@/stores/auth";

export function RequireAuth({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { token, user } = useAuthStore();
  if (!token || !user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
