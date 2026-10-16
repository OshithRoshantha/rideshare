import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Bell, MapPin } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { api } from "@/lib/api";
import { formatDateLabel, formatMoney, formatTime12h, STATUS_LABELS } from "@/lib/format";
import { useAuthStore } from "@/stores/auth";
import { useBookingDraft } from "@/stores/booking";

interface Booking {
  id: string;
  date: string;
  status: string;
  direction: string;
  fare_snapshot: { fare: number };
  corridor?: { name: string };
  pickup_stop?: { name: string };
  trip?: { stop_schedule: { stop_id: string; eta: string }[] };
  vehicle?: { plate_no: string; model: string };
}

export default function HomePage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const setPoints = useBookingDraft((s) => s.setPoints);

  const { data: upcoming, isLoading } = useQuery({
    queryKey: ["bookings", "upcoming"],
    queryFn: async () => (await api.get<Booking[]>("/bookings", { params: { scope: "upcoming" } })).data,
  });

  const { data: notifications } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => (await api.get("/notifications")).data as { id: string; title: string; body: string; read: boolean }[],
  });

  const nextRide = upcoming?.[0];
  const homePlace = user?.saved_places.find((p) => p.label === "Home");
  const officePlace = user?.saved_places.find((p) => p.label === "Office");

  function quickBook(origin: typeof homePlace, destination: typeof officePlace) {
    if (!origin || !destination) {
      navigate("/app/book");
      return;
    }
    setPoints(origin, destination);
    navigate("/app/book");
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold">Hi, {user?.full_name.split(" ")[0]} 👋</h2>
        <p className="text-sm text-text-secondary">Ready for your next commute?</p>
      </div>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-text-secondary">Next ride</h3>
        {isLoading ? (
          <Skeleton className="h-28 w-full" />
        ) : nextRide ? (
          <Link to={`/app/rides/${nextRide.id}`}>
            <Card className="shadow-soft transition-shadow hover:shadow-none">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold">{nextRide.corridor?.name}</p>
                  <p className="text-sm text-text-secondary">
                    {formatDateLabel(nextRide.date)} · Pickup at {nextRide.pickup_stop?.name}
                  </p>
                </div>
                <Badge status={nextRide.status} label={STATUS_LABELS[nextRide.status] ?? nextRide.status} />
              </div>
              {nextRide.vehicle && (
                <p className="mt-3 text-sm text-text-secondary">
                  {nextRide.vehicle.model} · {nextRide.vehicle.plate_no}
                </p>
              )}
              <div className="mt-3 flex items-center gap-1 text-sm font-medium text-accent">
                View details <ArrowRight className="h-4 w-4" />
              </div>
            </Card>
          </Link>
        ) : (
          <EmptyState
            icon={MapPin}
            title="No upcoming rides"
            description="Book your next commute in a few taps."
            action={
              <Link to="/app/book" className="text-sm font-medium text-accent">
                Book a ride
              </Link>
            }
          />
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-text-secondary">Quick actions</h3>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => quickBook(homePlace, officePlace)}
            className="rounded-card border border-border p-4 text-left hover:bg-surface"
          >
            <p className="font-medium">Home → Office</p>
            <p className="text-xs text-text-secondary">Morning commute</p>
          </button>
          <button
            onClick={() => quickBook(officePlace, homePlace)}
            className="rounded-card border border-border p-4 text-left hover:bg-surface"
          >
            <p className="font-medium">Office → Home</p>
            <p className="text-xs text-text-secondary">Evening commute</p>
          </button>
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-text-secondary">Recent notifications</h3>
        <div className="flex flex-col gap-2">
          {notifications?.slice(0, 3).map((n) => (
            <div key={n.id} className="flex gap-3 rounded-input border border-border p-3">
              <Bell className="mt-0.5 h-4 w-4 flex-shrink-0 text-text-muted" />
              <div>
                <p className="text-sm font-medium">{n.title}</p>
                <p className="text-xs text-text-secondary">{n.body}</p>
              </div>
            </div>
          ))}
          {notifications?.length === 0 && <p className="text-sm text-text-muted">No notifications yet.</p>}
        </div>
      </section>
    </div>
  );
}
