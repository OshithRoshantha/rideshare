import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";

import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { api } from "@/lib/api";
import { STATUS_LABELS } from "@/lib/format";
import { useAuthStore } from "@/stores/auth";

export default function DriverProfilePage() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: driver } = useQuery({
    queryKey: ["driver", "me"],
    queryFn: async () => (await api.get("/driver/me")).data,
  });

  if (!user) return null;

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5">
      <div className="flex items-center gap-4">
        <Avatar name={user.full_name} size={56} />
        <div>
          <h2 className="text-lg font-semibold">{user.full_name}</h2>
          <p className="text-sm text-text-secondary">{user.email}</p>
        </div>
      </div>

      {driver && (
        <Card>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Status</span>
            <Badge status={driver.status} label={STATUS_LABELS[driver.status] ?? driver.status} />
          </div>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span>Rating</span>
            <span>⭐ {driver.rating_avg?.toFixed(1)} ({driver.rating_count})</span>
          </div>
          {driver.vehicle && (
            <div className="mt-2 text-sm text-text-secondary">
              {driver.vehicle.model} · {driver.vehicle.colour} · {driver.vehicle.plate_no}
            </div>
          )}
        </Card>
      )}

      <Button
        variant="secondary"
        onClick={() => {
          logout();
          queryClient.clear();
          navigate("/login");
        }}
      >
        <LogOut className="h-4 w-4" /> Log out
      </Button>
    </div>
  );
}
