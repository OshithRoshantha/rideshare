import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, MapPin } from "lucide-react";

import { MapView } from "@/components/map/MapView";
import { RoutePolyline } from "@/components/map/RoutePolyline";
import { StopMarker } from "@/components/map/StopMarker";
import { type GeoResult, LocationSearch } from "@/components/map/LocationSearch";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { api } from "@/lib/api";
import { formatKm, formatMoney, formatWalkDistance } from "@/lib/format";
import { useAuthStore } from "@/stores/auth";
import { type RouteOption, useBookingDraft } from "@/stores/booking";

const COLOMBO_CENTER: [number, number] = [6.9271, 79.8612];

export function StepWhere({ onNext }: { onNext: () => void }) {
  const { user } = useAuthStore();
  const { origin, destination, setPoints, setOption, selectedOption } = useBookingDraft();
  const [originText, setOriginText] = useState(origin?.name ?? "");
  const [destText, setDestText] = useState(destination?.name ?? "");
  const [pickingOn, setPickingOn] = useState<"origin" | "destination" | null>(null);
  const [options, setOptions] = useState<RouteOption[] | null>(null);

  const searchMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/routes/options", { origin, destination });
      return res.data as RouteOption[];
    },
    onSuccess: (data) => setOptions(data),
  });

  function selectPoint(kind: "origin" | "destination", point: { name: string; lat: number; lng: number }) {
    if (kind === "origin") {
      setOriginText(point.name);
      setPoints(point, destination);
    } else {
      setDestText(point.name);
      setPoints(origin, point);
    }
    setOptions(null);
  }

  function handleMapClick(lat: number, lng: number) {
    if (!pickingOn) return;
    api.get("/geo/reverse", { params: { lat, lng } }).then((res) => {
      selectPoint(pickingOn, { name: res.data.name, lat, lng });
      setPickingOn(null);
    });
  }

  const canSearch = !!origin && !!destination;

  return (
    <div className="flex h-full flex-col gap-4 md:grid md:grid-cols-[440px_1fr] md:gap-6">
      <div className="flex flex-col gap-4">
        <Card className="flex flex-col gap-3 shadow-soft">
          <div>
            <p className="mb-1 text-xs font-medium text-text-secondary">Pickup</p>
            <LocationSearch
              placeholder="Search pickup location"
              value={originText}
              onChange={setOriginText}
              onSelect={(r: GeoResult) => selectPoint("origin", r)}
            />
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-text-secondary">Destination</p>
            <LocationSearch
              placeholder="Search destination"
              value={destText}
              onChange={setDestText}
              onSelect={(r: GeoResult) => selectPoint("destination", r)}
            />
          </div>

          {user?.saved_places && user.saved_places.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {user.saved_places.map((p) => (
                <Chip key={p.label} onClick={() => selectPoint(origin ? "destination" : "origin", p)}>
                  {p.label}: {p.name}
                </Chip>
              ))}
            </div>
          )}

          <div className="flex gap-2 text-xs text-text-secondary">
            <button
              type="button"
              className="underline"
              onClick={() => setPickingOn(pickingOn === "origin" ? null : "origin")}
            >
              {pickingOn === "origin" ? "Tap the map to set pickup…" : "Tap on map for pickup"}
            </button>
            <span>·</span>
            <button
              type="button"
              className="underline"
              onClick={() => setPickingOn(pickingOn === "destination" ? null : "destination")}
            >
              {pickingOn === "destination" ? "Tap the map to set destination…" : "Tap on map for destination"}
            </button>
          </div>

          <Button disabled={!canSearch} loading={searchMutation.isPending} onClick={() => searchMutation.mutate()}>
            Find routes
          </Button>
        </Card>

        <div className="flex-1 overflow-y-auto">
          {searchMutation.isPending && <p className="text-sm text-text-secondary">Searching corridors…</p>}
          {options && options.length === 0 && (
            <EmptyState
              icon={MapPin}
              title="We don't cover this route yet"
              description="Let us know and we'll notify you when we do."
              action={
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => origin && destination && api.post("/route-requests", { origin, destination })}
                >
                  Notify me
                </Button>
              }
            />
          )}
          {options && options.length > 0 && (
            <div className="flex flex-col gap-3">
              {options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => setOption(opt)}
                  className={`w-full rounded-card border p-4 text-left transition-colors ${
                    selectedOption === opt ? "border-accent bg-accent-soft" : "border-border hover:bg-surface"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{opt.corridor.name}</p>
                    <p className="font-semibold text-accent">{formatMoney(opt.fare_quote.fare)}</p>
                  </div>
                  <p className="mt-1 text-xs capitalize text-text-secondary">{opt.direction}</p>
                  <div className="mt-2 flex flex-col gap-1 text-xs text-text-secondary">
                    <span>
                      Pickup: {opt.pickup_stop.name} · {formatWalkDistance(opt.walk_to_pickup_m)}
                    </span>
                    <span>
                      Drop-off: {opt.drop_stop.name} · {formatWalkDistance(opt.walk_from_drop_m)}
                    </span>
                    <span>{formatKm(opt.passenger_km)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <Button disabled={!selectedOption} onClick={onNext} size="lg">
          Continue <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="h-72 overflow-hidden rounded-card border border-border md:h-full">
        <MapView center={origin ? [origin.lat, origin.lng] : COLOMBO_CENTER} onMapClick={handleMapClick}>
          {origin && <StopMarker lat={origin.lat} lng={origin.lng} label={origin.name} kind="origin" />}
          {destination && <StopMarker lat={destination.lat} lng={destination.lng} label={destination.name} kind="destination" />}
          {selectedOption && (
            <>
              <RoutePolyline points={selectedOption.corridor.polyline as [number, number][]} />
              <StopMarker lat={selectedOption.pickup_stop.lat} lng={selectedOption.pickup_stop.lng} label={selectedOption.pickup_stop.name} />
              <StopMarker lat={selectedOption.drop_stop.lat} lng={selectedOption.drop_stop.lng} label={selectedOption.drop_stop.name} />
              {origin && (
                <RoutePolyline
                  points={[
                    [origin.lat, origin.lng],
                    [selectedOption.pickup_stop.lat, selectedOption.pickup_stop.lng],
                  ]}
                  dashed
                />
              )}
              {destination && (
                <RoutePolyline
                  points={[
                    [selectedOption.drop_stop.lat, selectedOption.drop_stop.lng],
                    [destination.lat, destination.lng],
                  ]}
                  dashed
                />
              )}
            </>
          )}
        </MapView>
      </div>
    </div>
  );
}
