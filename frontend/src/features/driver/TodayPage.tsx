import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, CheckCircle, UserX } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { api, apiErrorMessage } from "@/lib/api";
import { formatMoney, formatTime12h, STATUS_LABELS } from "@/lib/format";

interface TripBooking {
  id: string;
  status: string;
  passenger_first_name: string;
  pickup_stop: { id: string; name: string };
  drop_stop: { id: string; name: string };
}
interface Trip {
  id: string;
  status: string;
  corridor: { name: string };
  slot: { departure_time: string };
  stop_schedule: { stop_id: string; eta: string; pickups: string[]; drops: string[] }[];
  bookings: TripBooking[];
  totals: { passengers: number; driver_payout: number };
}

const NEXT_ACTION: Record<string, { label: string; action: string } | null> = {
  planned: { label: "Accept trip", action: "accept" },
  driver_accepted: { label: "Start trip", action: "start" },
  in_progress: { label: "Complete trip", action: "complete" },
  completed: null,
  cancelled: null,
};

export default function TodayPage() {
  const queryClient = useQueryClient();
  const { data: trips, isLoading } = useQuery({
    queryKey: ["driver-trips", "today"],
    queryFn: async () => (await api.get<Trip[]>("/driver/trips", { params: { scope: "today" } })).data,
  });

  const actionMutation = useMutation({
    mutationFn: async ({ tripId, action }: { tripId: string; action: string }) => (await api.post(`/driver/trips/${tripId}/${action}`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["driver-trips"] }),
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const boardMutation = useMutation({
    mutationFn: async ({ tripId, bookingId, kind }: { tripId: string; bookingId: string; kind: "boarded" | "no-show" }) =>
      (await api.post(`/driver/trips/${tripId}/bookings/${bookingId}/${kind}`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["driver-trips"] }),
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!trips?.length) return <EmptyState icon={CalendarClock} title="No trips today" description="Check back once trips are assigned." />;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      {trips.map((trip) => {
        const next = NEXT_ACTION[trip.status];
        return (
          <Card key={trip.id} className="flex flex-col gap-4 shadow-soft">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-lg font-semibold">{trip.corridor.name}</p>
                <p className="text-sm text-text-secondary">Departure {formatTime12h(trip.slot.departure_time)}</p>
              </div>
              <Badge status={trip.status} label={STATUS_LABELS[trip.status] ?? trip.status} />
            </div>

            <div className="flex gap-4 text-sm text-text-secondary">
              <span>{trip.totals.passengers} passengers</span>
              <span>Est. payout {formatMoney(trip.totals.driver_payout)}</span>
            </div>

            <div className="flex flex-col gap-2">
              {trip.stop_schedule.map((stop) => (
                <div key={stop.stop_id} className="rounded-input border border-border p-3">
                  <p className="mb-2 text-sm font-semibold">{formatTime12h(stop.eta)}</p>
                  <div className="flex flex-col gap-2">
                    {trip.bookings
                      .filter((b) => stop.pickups.includes(b.id) || stop.drops.includes(b.id))
                      .map((b) => (
                        <div key={b.id} className="flex items-center justify-between text-sm">
                          <span>
                            {b.passenger_first_name} · {stop.pickups.includes(b.id) ? `Board at ${b.pickup_stop.name}` : `Alight at ${b.drop_stop.name}`}
                          </span>
                          {stop.pickups.includes(b.id) && trip.status === "in_progress" && b.status !== "no_show" && (
                            <div className="flex gap-1">
                              <button
                                className="rounded-full bg-success/10 p-1.5 text-success"
                                aria-label="Mark boarded"
                                onClick={() => boardMutation.mutate({ tripId: trip.id, bookingId: b.id, kind: "boarded" })}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </button>
                              <button
                                className="rounded-full bg-danger/10 p-1.5 text-danger"
                                aria-label="Mark no-show"
                                onClick={() => boardMutation.mutate({ tripId: trip.id, bookingId: b.id, kind: "no-show" })}
                              >
                                <UserX className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>

            {next && (
              <Button size="lg" loading={actionMutation.isPending} onClick={() => actionMutation.mutate({ tripId: trip.id, action: next.action })}>
                {next.label}
              </Button>
            )}
          </Card>
        );
      })}
    </div>
  );
}
