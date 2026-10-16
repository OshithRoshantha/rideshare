import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Segmented } from "@/components/ui/Segmented";
import { api, apiErrorMessage } from "@/lib/api";
import { formatTime12h } from "@/lib/format";

interface Corridor {
  id: string;
  name: string;
  slots: { id: string; direction: string; departure_time: string }[];
}
interface AvailabilityItem {
  corridor_id: string;
  direction: "inbound" | "outbound";
  slot_ids: string[];
  weekdays: number[];
}

const WEEKDAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
];

export default function AvailabilityPage() {
  const queryClient = useQueryClient();
  const [corridorId, setCorridorId] = useState<string | null>(null);
  const [direction, setDirection] = useState<"inbound" | "outbound">("inbound");
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>([]);
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);

  const { data: corridors } = useQuery({
    queryKey: ["corridors"],
    queryFn: async () => (await api.get<Corridor[]>("/corridors")).data,
  });

  const { data: driver } = useQuery({
    queryKey: ["driver", "me"],
    queryFn: async () => (await api.get("/driver/me")).data,
  });

  useEffect(() => {
    if (corridors && corridors.length > 0 && !corridorId) setCorridorId(corridors[0].id);
  }, [corridors, corridorId]);

  const existing: AvailabilityItem[] = driver?.availability ?? [];
  const currentEntry = existing.find((a) => a.corridor_id === corridorId && a.direction === direction);

  useEffect(() => {
    setSelectedSlotIds(currentEntry?.slot_ids ?? []);
    setWeekdays(currentEntry?.weekdays ?? [1, 2, 3, 4, 5]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [corridorId, direction, driver]);

  const mutation = useMutation({
    mutationFn: async (availability: AvailabilityItem[]) => (await api.patch("/driver/availability", { availability })).data,
    onSuccess: () => {
      toast.success("Availability updated");
      queryClient.invalidateQueries({ queryKey: ["driver", "me"] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  function save() {
    if (!corridorId) return;
    const others = existing.filter((a) => !(a.corridor_id === corridorId && a.direction === direction));
    const updated = selectedSlotIds.length > 0 ? [...others, { corridor_id: corridorId, direction, slot_ids: selectedSlotIds, weekdays }] : others;
    mutation.mutate(updated);
  }

  const corridor = corridors?.find((c) => c.id === corridorId);
  const slots = corridor?.slots.filter((s) => s.direction === direction) ?? [];

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5">
      <h2 className="text-xl font-semibold">Availability</h2>

      <div>
        <p className="mb-2 text-sm font-medium text-text-secondary">Corridor</p>
        <div className="flex flex-wrap gap-2">
          {corridors?.map((c) => (
            <Chip key={c.id} selected={corridorId === c.id} onClick={() => setCorridorId(c.id)}>
              {c.name}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-text-secondary">Direction</p>
        <Segmented
          options={[
            { value: "inbound", label: "Inbound" },
            { value: "outbound", label: "Outbound" },
          ]}
          value={direction}
          onChange={setDirection}
        />
      </div>

      <Card>
        <p className="mb-2 text-sm font-medium text-text-secondary">Time slots</p>
        <div className="flex flex-wrap gap-2">
          {slots.map((s) => (
            <Chip
              key={s.id}
              selected={selectedSlotIds.includes(s.id)}
              onClick={() => setSelectedSlotIds((prev) => (prev.includes(s.id) ? prev.filter((id) => id !== s.id) : [...prev, s.id]))}
            >
              {formatTime12h(s.departure_time)}
            </Chip>
          ))}
        </div>
      </Card>

      <Card>
        <p className="mb-2 text-sm font-medium text-text-secondary">Weekdays</p>
        <div className="flex gap-2">
          {WEEKDAYS.map((w) => (
            <Chip
              key={w.value}
              selected={weekdays.includes(w.value)}
              onClick={() => setWeekdays((prev) => (prev.includes(w.value) ? prev.filter((d) => d !== w.value) : [...prev, w.value]))}
            >
              {w.label}
            </Chip>
          ))}
        </div>
      </Card>

      <Button fullWidth loading={mutation.isPending} onClick={save}>
        Save availability for this corridor
      </Button>

      {existing.length > 0 && (
        <Card>
          <p className="mb-2 text-sm font-medium text-text-secondary">Your current availability</p>
          <div className="flex flex-col gap-1 text-sm">
            {existing.map((a, i) => {
              const c = corridors?.find((c) => c.id === a.corridor_id);
              return (
                <p key={i}>
                  {c?.name} · {a.direction} · {a.slot_ids.length} slots
                </p>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
