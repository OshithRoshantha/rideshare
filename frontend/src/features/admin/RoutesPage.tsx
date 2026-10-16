import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GripVertical, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { MapView } from "@/components/map/MapView";
import { RoutePolyline } from "@/components/map/RoutePolyline";
import { StopMarker } from "@/components/map/StopMarker";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Input } from "@/components/ui/Input";
import { api, apiErrorMessage } from "@/lib/api";
import { formatTime12h } from "@/lib/format";

interface Stop {
  id: string;
  name: string;
  lat: number;
  lng: number;
  order: number;
  km_from_start: number;
}
interface TimeSlot {
  id: string;
  direction: "inbound" | "outbound";
  departure_time: string;
}
interface Corridor {
  id: string;
  name: string;
  polyline: [number, number][];
  total_km: number;
  stops: Stop[];
  slots: TimeSlot[];
}

export default function RoutesPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newStopName, setNewStopName] = useState("");
  const [newSlotTime, setNewSlotTime] = useState("07:00");
  const [newSlotDirection, setNewSlotDirection] = useState<"inbound" | "outbound">("inbound");

  const { data: corridors } = useQuery({
    queryKey: ["admin-corridors"],
    queryFn: async () => (await api.get<Corridor[]>("/admin/corridors")).data,
  });

  const corridor = corridors?.find((c) => c.id === (selectedId ?? corridors?.[0]?.id));

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin-corridors"] });
  }

  const addStopMutation = useMutation({
    mutationFn: async ({ lat, lng }: { lat: number; lng: number }) => {
      const geo = await api.get("/geo/reverse", { params: { lat, lng } });
      return api.post("/admin/stops", { name: newStopName || geo.data.name, lat, lng, order: (corridor?.stops.length ?? 0) }, { params: { corridor_id: corridor!.id } });
    },
    onSuccess: () => {
      toast.success("Stop added");
      invalidate();
      setNewStopName("");
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const deleteStopMutation = useMutation({
    mutationFn: async (stopId: string) => api.delete(`/admin/stops/${stopId}`),
    onSuccess: () => invalidate(),
  });

  const reorderMutation = useMutation({
    mutationFn: async ({ stop, newOrder }: { stop: Stop; newOrder: number }) =>
      api.patch(`/admin/stops/${stop.id}`, { name: stop.name, lat: stop.lat, lng: stop.lng, order: newOrder }),
    onSuccess: () => invalidate(),
  });

  const recomputeMutation = useMutation({
    mutationFn: async () => (await api.post(`/admin/corridors/${corridor!.id}/recompute`)).data,
    onSuccess: (res) => {
      toast.success(`Recomputed: ${res.total_km} km, ${res.total_min} min`);
      invalidate();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const addSlotMutation = useMutation({
    mutationFn: async () =>
      api.post("/admin/time-slots", {
        corridor_id: corridor!.id,
        direction: newSlotDirection,
        departure_time: newSlotTime,
        weekdays: [1, 2, 3, 4, 5],
        is_active: true,
      }),
    onSuccess: () => {
      toast.success("Slot added");
      invalidate();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const deleteSlotMutation = useMutation({
    mutationFn: async (slotId: string) => api.delete(`/admin/time-slots/${slotId}`),
    onSuccess: () => invalidate(),
  });

  function moveStop(stop: Stop, direction: -1 | 1) {
    if (!corridor) return;
    const sorted = [...corridor.stops].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((s) => s.id === stop.id);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const other = sorted[swapIdx];
    reorderMutation.mutate({ stop, newOrder: other.order });
    reorderMutation.mutate({ stop: other, newOrder: stop.order });
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">Routes</h2>
      <div className="flex flex-wrap gap-2">
        {corridors?.map((c) => (
          <Chip key={c.id} selected={corridor?.id === c.id} onClick={() => setSelectedId(c.id)}>
            {c.name}
          </Chip>
        ))}
      </div>

      {corridor && (
        <div className="grid gap-4 md:grid-cols-[1fr_380px]">
          <div className="h-96 overflow-hidden rounded-card border border-border">
            <MapView
              center={corridor.stops[0] ? [corridor.stops[0].lat, corridor.stops[0].lng] : [6.9271, 79.8612]}
              onMapClick={(lat, lng) => addStopMutation.mutate({ lat, lng })}
            >
              <RoutePolyline points={corridor.polyline} />
              {corridor.stops
                .sort((a, b) => a.order - b.order)
                .map((s) => (
                  <StopMarker key={s.id} lat={s.lat} lng={s.lng} label={`${s.order + 1}. ${s.name}`} />
                ))}
            </MapView>
          </div>

          <div className="flex flex-col gap-4">
            <Card>
              <div className="flex items-center justify-between">
                <p className="font-semibold">{corridor.total_km} km total</p>
                <Button size="sm" variant="secondary" loading={recomputeMutation.isPending} onClick={() => recomputeMutation.mutate()}>
                  <RefreshCw className="h-4 w-4" /> Recompute
                </Button>
              </div>
              <Input
                placeholder="New stop name (optional — tap map)"
                value={newStopName}
                onChange={(e) => setNewStopName(e.target.value)}
                hint="Click anywhere on the map to add a stop at that location"
                className="mt-3"
              />
            </Card>

            <Card>
              <p className="mb-2 font-semibold">Stops</p>
              <div className="flex flex-col gap-1">
                {corridor.stops
                  .sort((a, b) => a.order - b.order)
                  .map((s) => (
                    <div key={s.id} className="flex items-center gap-2 rounded-input bg-surface p-2 text-sm">
                      <GripVertical className="h-4 w-4 text-text-muted" />
                      <span className="flex-1">{s.name}</span>
                      <span className="text-xs text-text-secondary">{s.km_from_start} km</span>
                      <button onClick={() => moveStop(s, -1)} className="px-1 text-text-secondary">
                        ↑
                      </button>
                      <button onClick={() => moveStop(s, 1)} className="px-1 text-text-secondary">
                        ↓
                      </button>
                      <button onClick={() => deleteStopMutation.mutate(s.id)} className="text-danger">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
              </div>
            </Card>

            <Card>
              <p className="mb-2 font-semibold">Time slots</p>
              <div className="mb-3 flex gap-2">
                <select
                  value={newSlotDirection}
                  onChange={(e) => setNewSlotDirection(e.target.value as "inbound" | "outbound")}
                  className="h-10 rounded-input border border-border px-2 text-sm"
                >
                  <option value="inbound">Inbound</option>
                  <option value="outbound">Outbound</option>
                </select>
                <input
                  type="time"
                  value={newSlotTime}
                  onChange={(e) => setNewSlotTime(e.target.value)}
                  className="h-10 flex-1 rounded-input border border-border px-2 text-sm"
                />
                <Button size="sm" onClick={() => addSlotMutation.mutate()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-col gap-1 text-sm">
                {["inbound", "outbound"].map((dir) => (
                  <div key={dir}>
                    <p className="mb-1 text-xs font-medium capitalize text-text-secondary">{dir}</p>
                    {corridor.slots
                      .filter((s) => s.direction === dir)
                      .sort((a, b) => a.departure_time.localeCompare(b.departure_time))
                      .map((s) => (
                        <div key={s.id} className="mb-1 flex items-center justify-between rounded-input bg-surface px-3 py-1.5">
                          {formatTime12h(s.departure_time)}
                          <button onClick={() => deleteSlotMutation.mutate(s.id)} className="text-danger">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
