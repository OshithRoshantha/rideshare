import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { api, apiErrorMessage } from "@/lib/api";
import { formatDateLabel, formatMoney, formatTime12h } from "@/lib/format";
import { useAuthStore } from "@/stores/auth";
import { useBookingDraft } from "@/stores/booking";

export function StepReview({ onBack }: { onBack: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const draft = useBookingDraft();
  const [success, setSuccess] = useState(false);

  const { data: wallet } = useQuery({
    queryKey: ["wallet"],
    queryFn: async () => (await api.get("/wallet")).data as { balance: number },
  });

  const opt = draft.selectedOption!;
  const slot = opt.slots.find((s) => s.slot.id === draft.selectedSlotId);

  const rideCount = draft.bookingType === "repeat" && draft.repeatFrom && draft.repeatTo ? estimateRepeatCount(draft) : 1;
  const totalFare = opt.fare_quote.fare * rideCount;
  const insufficientBalance = !!wallet && wallet.balance < opt.fare_quote.fare;

  const mutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        corridor_id: opt.corridor.id,
        direction: opt.direction,
        slot_id: draft.selectedSlotId,
        pickup_stop_id: opt.pickup_stop.id,
        drop_stop_id: opt.drop_stop.id,
        origin: draft.origin,
        destination: draft.destination,
        booking_type: draft.bookingType,
      };
      if (draft.bookingType === "scheduled") payload.date = draft.date;
      if (draft.bookingType === "repeat") {
        payload.repeat = { weekdays: draft.repeatWeekdays, from_date: draft.repeatFrom, to_date: draft.repeatTo };
      }
      return (await api.post("/bookings", payload)).data;
    },
    onSuccess: () => {
      setSuccess(true);
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
    },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not complete your booking")),
  });

  if (success) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
        <CheckCircle2 className="h-16 w-16 text-success" />
        <h2 className="text-xl font-semibold">You're booked!</h2>
        <p className="text-text-secondary">We'll notify you once your ride is matched with a vehicle.</p>
        <div className="mt-4 flex gap-3">
          <Button
            variant="secondary"
            onClick={() => {
              draft.reset();
              navigate("/app/book");
            }}
          >
            Add another day
          </Button>
          <Button onClick={() => navigate("/app/rides")}>Go to my rides</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5">
      <Card>
        <p className="font-semibold">{opt.corridor.name}</p>
        <p className="text-sm capitalize text-text-secondary">{opt.direction}</p>
        <div className="mt-3 flex flex-col gap-1 text-sm">
          <span>Pickup: {opt.pickup_stop.name}</span>
          <span>Drop-off: {opt.drop_stop.name}</span>
          {draft.bookingType === "scheduled" && draft.date && <span>Date: {formatDateLabel(draft.date)}</span>}
          {draft.bookingType === "repeat" && (
            <span>
              Repeats {draft.repeatWeekdays.length} days/week, {draft.repeatFrom} → {draft.repeatTo} ({rideCount} rides)
            </span>
          )}
          {slot && <span>Departure: {formatTime12h(slot.slot.departure_time)}</span>}
        </div>
      </Card>

      <Card>
        <p className="mb-3 font-semibold">Price breakdown</p>
        <div className="flex flex-col gap-2 text-sm">
          <Row label="Booking fee" value={formatMoney(opt.fare_quote.booking_fee)} />
          <Row label={`Distance (${opt.fare_quote.passenger_km} km × LKR ${opt.fare_quote.rate_per_km})`} value={formatMoney(opt.fare_quote.distance_fare)} />
          <div className="my-1 border-t border-border" />
          <Row label={rideCount > 1 ? `Total (${rideCount} rides × ${formatMoney(opt.fare_quote.fare)})` : "Total"} value={formatMoney(totalFare)} bold />
        </div>
        <div className="mt-3 rounded-input bg-accent-soft p-3 text-sm text-accent">
          Solo tuk/taxi approx. {formatMoney(opt.fare_quote.solo_estimate)} — you save ~{opt.fare_quote.savings_pct}%
        </div>
      </Card>

      <Card className="text-sm text-text-secondary">
        Wallet balance: <span className="font-semibold text-text-primary">{wallet ? formatMoney(wallet.balance) : "…"}</span>
        <p className="mt-2">
          Free cancellation before 9:00 PM the day before your ride. After that, no refund is given if you cancel.
        </p>
      </Card>

      {insufficientBalance && (
        <div className="rounded-input bg-amber-50 p-3 text-sm text-amber-800">
          Insufficient wallet balance.{" "}
          <button className="underline" onClick={() => navigate("/app/wallet")}>
            Top up now
          </button>
        </div>
      )}

      <div className="flex gap-3">
        <Button variant="secondary" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button fullWidth size="lg" loading={mutation.isPending} disabled={insufficientBalance} onClick={() => mutation.mutate()}>
          Confirm & pay {formatMoney(totalFare)}
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold" : "text-text-secondary"}`}>
      <span>{label}</span>
      <span className={bold ? "text-text-primary" : ""}>{value}</span>
    </div>
  );
}

function estimateRepeatCount(draft: ReturnType<typeof useBookingDraft.getState>): number {
  if (!draft.repeatFrom || !draft.repeatTo) return 1;
  const start = new Date(draft.repeatFrom);
  const end = new Date(draft.repeatTo);
  let count = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const iso = d.getDay() === 0 ? 7 : d.getDay();
    if (draft.repeatWeekdays.includes(iso)) count++;
  }
  return count || 1;
}
