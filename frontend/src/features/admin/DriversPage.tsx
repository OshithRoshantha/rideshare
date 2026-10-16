import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/Badge";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs } from "@/components/ui/Tabs";
import { api, apiErrorMessage } from "@/lib/api";
import { STATUS_LABELS } from "@/lib/format";

interface Driver {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  status: string;
  licence_no: string;
  nic_no: string;
  rating_avg: number;
  rating_count: number;
  vehicle?: { type: string; seats: number; plate_no: string; model: string; colour: string };
}

export default function DriversPage() {
  const [status, setStatus] = useState<"pending" | "approved" | "suspended">("pending");
  const [selected, setSelected] = useState<Driver | null>(null);
  const queryClient = useQueryClient();

  const { data: drivers, isLoading } = useQuery({
    queryKey: ["admin-drivers", status],
    queryFn: async () => (await api.get<Driver[]>("/admin/drivers", { params: { status } })).data,
  });

  const actionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: string }) => (await api.post(`/admin/drivers/${id}/${action}`)).data,
    onSuccess: () => {
      toast.success("Driver updated");
      queryClient.invalidateQueries({ queryKey: ["admin-drivers"] });
      setSelected(null);
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">Drivers</h2>
      <Tabs
        tabs={[
          { value: "pending", label: "Pending" },
          { value: "approved", label: "Approved" },
          { value: "suspended", label: "Suspended" },
        ]}
        value={status}
        onChange={setStatus}
      />

      {isLoading && <Skeleton className="h-40 w-full" />}
      {!isLoading && drivers?.length === 0 && <EmptyState icon={ShieldCheck} title={`No ${status} drivers`} />}

      <div className="grid gap-3 md:grid-cols-2">
        {drivers?.map((d) => (
          <button key={d.id} onClick={() => setSelected(d)} className="text-left">
            <Card className="hover:bg-surface">
              <div className="flex items-center justify-between">
                <p className="font-semibold">{d.full_name}</p>
                <Badge status={d.status} label={STATUS_LABELS[d.status] ?? d.status} />
              </div>
              <p className="text-sm text-text-secondary">{d.email}</p>
              {d.vehicle && (
                <p className="mt-1 text-sm text-text-secondary">
                  {d.vehicle.type} · {d.vehicle.seats} seats · {d.vehicle.plate_no}
                </p>
              )}
            </Card>
          </button>
        ))}
      </div>

      <BottomSheet open={!!selected} onClose={() => setSelected(null)}>
        {selected && (
          <div className="flex flex-col gap-3">
            <h3 className="text-lg font-semibold">{selected.full_name}</h3>
            <p className="text-sm text-text-secondary">{selected.email} · {selected.phone}</p>
            <div className="rounded-input bg-surface p-3 text-sm">
              <p>Licence: {selected.licence_no || "—"}</p>
              <p>NIC: {selected.nic_no || "—"}</p>
              <p>
                Rating: ⭐ {selected.rating_avg?.toFixed(1)} ({selected.rating_count})
              </p>
            </div>
            {selected.vehicle && (
              <div className="rounded-input bg-surface p-3 text-sm">
                <p>Type: {selected.vehicle.type}</p>
                <p>Seats: {selected.vehicle.seats}</p>
                <p>Plate: {selected.vehicle.plate_no}</p>
                <p>
                  {selected.vehicle.model} · {selected.vehicle.colour}
                </p>
              </div>
            )}
            <div className="flex gap-2">
              {selected.status === "pending" && (
                <>
                  <Button fullWidth onClick={() => actionMutation.mutate({ id: selected.id, action: "approve" })}>
                    Approve
                  </Button>
                  <Button fullWidth variant="danger" onClick={() => actionMutation.mutate({ id: selected.id, action: "reject" })}>
                    Reject
                  </Button>
                </>
              )}
              {selected.status === "approved" && (
                <Button fullWidth variant="danger" onClick={() => actionMutation.mutate({ id: selected.id, action: "suspend" })}>
                  Suspend
                </Button>
              )}
              {selected.status === "suspended" && (
                <Button fullWidth onClick={() => actionMutation.mutate({ id: selected.id, action: "approve" })}>
                  Reinstate
                </Button>
              )}
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
