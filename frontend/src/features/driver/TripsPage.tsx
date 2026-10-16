import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutList } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs } from "@/components/ui/Tabs";
import { api, apiErrorMessage } from "@/lib/api";
import { formatDateLabel, formatMoney, formatTime12h, STATUS_LABELS } from "@/lib/format";

interface Trip {
  id: string;
  date: string;
  status: string;
  corridor: { name: string };
  slot: { departure_time: string };
  totals: { passengers: number; driver_payout: number };
}

export default function TripsPage() {
  const [scope, setScope] = useState<"upcoming" | "past">("upcoming");
  const queryClient = useQueryClient();

  const { data: trips, isLoading } = useQuery({
    queryKey: ["driver-trips", scope],
    queryFn: async () => (await api.get<Trip[]>("/driver/trips", { params: { scope } })).data,
  });

  const actionMutation = useMutation({
    mutationFn: async ({ tripId, action }: { tripId: string; action: string }) => (await api.post(`/driver/trips/${tripId}/${action}`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["driver-trips"] }),
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <h2 className="text-xl font-semibold">Trips</h2>
      <Tabs
        tabs={[
          { value: "upcoming", label: "Upcoming" },
          { value: "past", label: "Past" },
        ]}
        value={scope}
        onChange={setScope}
      />

      {isLoading && <Skeleton className="h-24 w-full" />}
      {!isLoading && trips?.length === 0 && <EmptyState icon={LayoutList} title={`No ${scope} trips`} />}

      <div className="flex flex-col gap-3">
        {trips?.map((trip) => (
          <Card key={trip.id}>
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold">{trip.corridor.name}</p>
                <p className="text-sm text-text-secondary">
                  {formatDateLabel(trip.date)} · {formatTime12h(trip.slot.departure_time)}
                </p>
              </div>
              <Badge status={trip.status} label={STATUS_LABELS[trip.status] ?? trip.status} />
            </div>
            <div className="mt-2 flex items-center justify-between text-sm text-text-secondary">
              <span>
                {trip.totals.passengers} passengers · Est. {formatMoney(trip.totals.driver_payout)}
              </span>
              {trip.status === "planned" && scope === "upcoming" && (
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => actionMutation.mutate({ tripId: trip.id, action: "decline" })}>
                    Decline
                  </Button>
                  <Button size="sm" onClick={() => actionMutation.mutate({ tripId: trip.id, action: "accept" })}>
                    Accept
                  </Button>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
