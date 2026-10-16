from app.services.geo import snap_to_corridor_stops
from app.services.matching import booking_segment, compute_peak_load, direction_stop_order, stop_index_map
from app.services.pricing import compute_fare, compute_savings_pct, compute_solo_estimate


def _segment_valid(pickup_idx: int, drop_idx: int) -> bool:
    return pickup_idx < drop_idx


def compute_route_options(origin: dict, destination: dict, repos, settings: dict, date: str | None = None, direction_filter: str | None = None) -> list[dict]:
    max_walk_m = settings.get("max_walk_m", 800)
    van_rate = settings.get("rate_per_km_van_lkr", 18)
    booking_fee = settings.get("booking_fee_lkr", 20)
    min_fare = settings.get("minimum_fare_lkr", 150)
    solo_rate = settings.get("solo_ride_rate_per_km_lkr", 100)

    corridors = [c for c in repos.corridors.all() if c.get("is_active", True)]
    options = []

    for corridor in corridors:
        stops = repos.stops.find(corridor_id=corridor["id"])
        if len(stops) < 2:
            continue
        origin_snap = snap_to_corridor_stops(origin["lat"], origin["lng"], stops, max_walk_m)
        dest_snap = snap_to_corridor_stops(destination["lat"], destination["lng"], stops, max_walk_m)
        if not origin_snap or not dest_snap or origin_snap["stop"]["id"] == dest_snap["stop"]["id"]:
            continue

        for direction in ("inbound", "outbound"):
            if direction_filter and direction != direction_filter:
                continue
            ordered = direction_stop_order(stops, direction)
            idx_map = stop_index_map(ordered)
            pickup_idx = idx_map[origin_snap["stop"]["id"]]
            drop_idx = idx_map[dest_snap["stop"]["id"]]
            if not _segment_valid(pickup_idx, drop_idx):
                continue

            pickup_stop = ordered[pickup_idx]
            drop_stop = ordered[drop_idx]
            passenger_km = abs(drop_stop.get("km_from_start", 0) - pickup_stop.get("km_from_start", 0))
            breakdown = compute_fare(passenger_km, van_rate, booking_fee, min_fare)
            solo_estimate = compute_solo_estimate(passenger_km, solo_rate)
            savings_pct = compute_savings_pct(breakdown.fare, solo_estimate)

            slots = [s for s in repos.time_slots.find(corridor_id=corridor["id"], direction=direction) if s.get("is_active", True)]
            slot_infos = []
            for slot in sorted(slots, key=lambda s: s["departure_time"]):
                seats_booked = 0
                if date:
                    existing = repos.bookings.find(corridor_id=corridor["id"], direction=direction, date=date, slot_id=slot["id"])
                    existing = [b for b in existing if b["status"] in ("pending", "confirmed")]
                    segs = [
                        booking_segment(b["pickup_stop_id"], b["drop_stop_id"], idx_map)
                        for b in existing
                        if b["pickup_stop_id"] in idx_map and b["drop_stop_id"] in idx_map
                    ]
                    segs.append((pickup_idx, drop_idx))
                    seats_booked = compute_peak_load(segs)
                hh, mm = map(int, slot["departure_time"].split(":"))
                dep_minutes = hh * 60 + mm
                travel_min = abs(pickup_stop.get("min_from_start", 0) - ordered[0].get("min_from_start", 0))
                eta_minutes = dep_minutes + travel_min
                eta_h, eta_m = int(eta_minutes // 60) % 24, int(eta_minutes % 60)
                slot_infos.append(
                    {
                        "slot": slot,
                        "eta_at_pickup": f"{eta_h:02d}:{eta_m:02d}",
                        "seats_booked": seats_booked,
                        "available": True,
                    }
                )

            options.append(
                {
                    "corridor": corridor,
                    "direction": direction,
                    "pickup_stop": pickup_stop,
                    "drop_stop": drop_stop,
                    "walk_to_pickup_m": origin_snap["walk_m"],
                    "walk_from_drop_m": dest_snap["walk_m"],
                    "passenger_km": round(passenger_km, 2),
                    "fare_quote": {
                        "passenger_km": round(passenger_km, 2),
                        "rate_per_km": van_rate,
                        "booking_fee": booking_fee,
                        "distance_fare": breakdown.distance_fare,
                        "fare": breakdown.fare,
                        "solo_estimate": solo_estimate,
                        "savings_pct": savings_pct,
                    },
                    "slots": slot_infos,
                }
            )

    return options
