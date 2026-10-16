import { useMemo } from "react";
import { addDays, format } from "date-fns";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Segmented } from "@/components/ui/Segmented";
import { formatDateLabel, formatTime12h } from "@/lib/format";
import { useBookingDraft } from "@/stores/booking";

const WEEKDAY_LABELS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
];

function nextWeekdays(count: number): string[] {
  const days: string[] = [];
  let cur = addDays(new Date(), 1);
  while (days.length < count) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) days.push(format(cur, "yyyy-MM-dd"));
    cur = addDays(cur, 1);
  }
  return days;
}

export function StepWhen({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { selectedOption, bookingType, setBookingType, date, setDate, repeatWeekdays, repeatFrom, repeatTo, setRepeat, selectedSlotId, setSlot } =
    useBookingDraft();

  const dateOptions = useMemo(() => nextWeekdays(14), []);

  if (!selectedOption) return null;

  const canContinue =
    (bookingType === "scheduled" && !!date && !!selectedSlotId) ||
    (bookingType === "repeat" && repeatWeekdays.length > 0 && !!repeatFrom && !!repeatTo && !!selectedSlotId) ||
    bookingType === "now";

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium text-text-secondary">Direction</p>
        <Segmented
          options={[
            { value: "inbound", label: "Inbound (to city)" },
            { value: "outbound", label: "Outbound (from city)" },
          ]}
          value={selectedOption.direction}
          onChange={() => {}}
        />
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-text-secondary">When</p>
        <Segmented
          options={[
            { value: "scheduled", label: "Schedule" },
            { value: "repeat", label: "Repeat" },
            { value: "now", label: "Now" },
          ]}
          value={bookingType}
          onChange={setBookingType}
        />
      </div>

      {bookingType === "scheduled" && (
        <div>
          <p className="mb-2 text-sm font-medium text-text-secondary">Date</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {dateOptions.map((d) => (
              <Chip key={d} selected={date === d} onClick={() => setDate(d)}>
                {formatDateLabel(d)}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {bookingType === "repeat" && (
        <div className="flex flex-col gap-3">
          <div>
            <p className="mb-2 text-sm font-medium text-text-secondary">Repeat on</p>
            <div className="flex gap-2">
              {WEEKDAY_LABELS.map((w) => (
                <Chip
                  key={w.value}
                  selected={repeatWeekdays.includes(w.value)}
                  onClick={() =>
                    setRepeat(
                      repeatWeekdays.includes(w.value) ? repeatWeekdays.filter((d) => d !== w.value) : [...repeatWeekdays, w.value],
                      repeatFrom ?? dateOptions[0],
                      repeatTo ?? dateOptions[9],
                    )
                  }
                >
                  {w.label}
                </Chip>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">From</label>
              <input
                type="date"
                value={repeatFrom ?? dateOptions[0]}
                onChange={(e) => setRepeat(repeatWeekdays, e.target.value, repeatTo ?? dateOptions[9])}
                className="h-11 w-full rounded-input border border-border px-3 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">To</label>
              <input
                type="date"
                value={repeatTo ?? dateOptions[9]}
                onChange={(e) => setRepeat(repeatWeekdays, repeatFrom ?? dateOptions[0], e.target.value)}
                className="h-11 w-full rounded-input border border-border px-3 text-sm"
              />
            </div>
          </div>
        </div>
      )}

      {bookingType !== "now" && (
        <div>
          <p className="mb-2 text-sm font-medium text-text-secondary">Departure time</p>
          <div className="flex flex-col gap-2">
            {selectedOption.slots.map((s) => (
              <button
                key={s.slot.id}
                onClick={() => setSlot(s.slot.id)}
                className={`flex items-center justify-between rounded-input border p-3 text-left text-sm transition-colors ${
                  selectedSlotId === s.slot.id ? "border-accent bg-accent-soft" : "border-border hover:bg-surface"
                }`}
              >
                <span className="font-medium">{formatTime12h(s.slot.departure_time)}</span>
                <span className="text-text-secondary">
                  pickup {formatTime12h(s.eta_at_pickup)} · {s.seats_booked} riders so far
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {bookingType === "now" && (
        <p className="rounded-input bg-surface p-4 text-sm text-text-secondary">
          We'll place you on the next available vehicle today with a free seat on your segment — if there isn't one, you'll be asked to
          schedule for tomorrow instead.
        </p>
      )}

      <div className="flex gap-3">
        <Button variant="secondary" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button disabled={!canContinue} onClick={onNext} fullWidth>
          Continue <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
