import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { toast } from "sonner";

import { MapView } from "@/components/map/MapView";
import { RoutePolyline } from "@/components/map/RoutePolyline";
import { StopMarker } from "@/components/map/StopMarker";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { api, apiErrorMessage } from "@/lib/api";
import { formatDateLabel, formatMoney, formatTime12h, STATUS_LABELS } from "@/lib/format";

export default function RideDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCancel, setShowCancel] = useState(false);
  const [showRate, setShowRate] = useState(false);
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState("");

  const { data: booking, isLoading } = useQuery({
    queryKey: ["booking", id],
    queryFn: async () => (await api.get(`/bookings/${id}`)).data,
  });

  const cancelMutation = useMutation({
    mutationFn: async () => (await api.post(`/bookings/${id}/cancel`)).data,
    onSuccess: () => {
      toast.success("Booking cancelled");
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["booking", id] });
      setShowCancel(false);
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const rateMutation = useMutation({
    mutationFn: async () => (await api.post(`/bookings/${id}/rate`, { stars, comment })).data,
    onSuccess: () => {
      toast.success("Thanks for your feedback!");
      queryClient.invalidateQueries({ queryKey: ["booking", id] });
      setShowRate(false);
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  if (isLoading || !booking) return <Skeleton className="h-96 w-full" />;

  const corridor = booking.corridor;
  const trip = booking.trip;
  const canCancel = ["pending", "confirmed"].includes(booking.status);
  const canRate = booking.status === "completed";

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{corridor?.name}</h2>
          <p className="text-sm text-text-secondary">{formatDateLabel(booking.date)}</p>
        </div>
        <Badge status={booking.status} label={STATUS_LABELS[booking.status] ?? booking.status} />
      </div>

      {corridor?.polyline && (
        <div className="h-56 overflow-hidden rounded-card border border-border">
          <MapView center={[booking.pickup_stop.lat, booking.pickup_stop.lng]}>
            <RoutePolyline points={corridor.polyline} />
            <StopMarker lat={booking.pickup_stop.lat} lng={booking.pickup_stop.lng} label={`Pickup: ${booking.pickup_stop.name}`} kind="origin" />
            <StopMarker lat={booking.drop_stop.lat} lng={booking.drop_stop.lng} label={`Drop-off: ${booking.drop_stop.name}`} kind="destination" />
          </MapView>
        </div>
      )}

      {trip?.stop_schedule?.length > 0 && (
        <Card>
          <p className="mb-3 font-semibold">Trip timeline</p>
          <div className="flex flex-col gap-3">
            {trip.stop_schedule.map((s: { stop_id: string; eta: string; pickups: string[]; drops: string[] }) => {
              const isMine = s.pickups.includes(booking.id) || s.drops.includes(booking.id);
              return (
                <div key={s.stop_id} className="flex items-center gap-3 text-sm">
                  <div className={`h-2.5 w-2.5 rounded-full ${isMine ? "bg-accent" : "bg-border"}`} />
                  <span className={isMine ? "font-semibold" : "text-text-secondary"}>{formatTime12h(s.eta)}</span>
                  {isMine && <span className="text-accent">{s.pickups.includes(booking.id) ? "Your pickup" : "Your drop-off"}</span>}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {booking.driver && (
        <Card>
          <p className="mb-2 font-semibold">Your driver</p>
          <p className="text-sm">
            {booking.driver.full_name} · ⭐ {booking.driver.rating_avg?.toFixed(1)}
          </p>
          {booking.vehicle && (
            <p className="text-sm text-text-secondary">
              {booking.vehicle.model} · {booking.vehicle.colour} · {booking.vehicle.plate_no}
            </p>
          )}
        </Card>
      )}

      <Card>
        <p className="mb-2 font-semibold">Fare</p>
        <p className="text-lg font-semibold">{formatMoney(booking.fare_snapshot.fare)}</p>
        <p className="text-xs text-text-secondary">{booking.fare_snapshot.passenger_km} km</p>
      </Card>

      <div className="flex gap-3">
        {canCancel && (
          <Button variant="danger" onClick={() => setShowCancel(true)}>
            Cancel ride
          </Button>
        )}
        {canRate && (
          <Button onClick={() => setShowRate(true)}>
            <Star className="h-4 w-4" /> Rate this trip
          </Button>
        )}
      </div>

      <Modal open={showCancel} onClose={() => setShowCancel(false)} title="Cancel this ride?">
        <p className="mb-4 text-sm text-text-secondary">
          Cancelling before 9:00 PM the day before your ride refunds the full fare to your wallet. After that, no refund is given.
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={() => setShowCancel(false)}>
            Keep ride
          </Button>
          <Button variant="danger" fullWidth loading={cancelMutation.isPending} onClick={() => cancelMutation.mutate()}>
            Yes, cancel
          </Button>
        </div>
      </Modal>

      <Modal open={showRate} onClose={() => setShowRate(false)} title="Rate your trip">
        <div className="mb-4 flex justify-center gap-1">
          {[1, 2, 3, 4, 5].map((s) => (
            <button key={s} onClick={() => setStars(s)} aria-label={`${s} stars`}>
              <Star className={`h-8 w-8 ${s <= stars ? "fill-amber-400 text-amber-400" : "text-border"}`} />
            </button>
          ))}
        </div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Optional comment"
          className="mb-4 h-20 w-full rounded-input border border-border p-3 text-sm"
        />
        <Button fullWidth loading={rateMutation.isPending} onClick={() => rateMutation.mutate()}>
          Submit rating
        </Button>
      </Modal>
    </div>
  );
}
