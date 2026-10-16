"""Matching engine: groups pending bookings into vehicle trips.

Pure helper functions are unit-tested directly; `run_matching` is the
orchestrator that reads/writes the JSON repositories.
"""

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime

from app.services import pricing
from app.services.notifications import notify
from app.storage.repositories import get_repos


def direction_stop_order(stops: list[dict], direction: str) -> list[dict]:
    ordered = sorted(stops, key=lambda s: s["order"])
    if direction == "outbound":
        ordered = list(reversed(ordered))
    return ordered


def stop_index_map(stops_ordered: list[dict]) -> dict[str, int]:
    return {s["id"]: i for i, s in enumerate(stops_ordered)}


def booking_segment(pickup_stop_id: str, drop_stop_id: str, idx_map: dict[str, int]) -> tuple[int, int]:
    return idx_map[pickup_stop_id], idx_map[drop_stop_id]


def compute_peak_load(segments: list[tuple[int, int]]) -> int:
    events = []
    for s, e in segments:
        events.append((s, 1))
        events.append((e, -1))
    events.sort(key=lambda x: (x[0], x[1]))
    cur = 0
    peak = 0
    for _, delta in events:
        cur += delta
        peak = max(peak, cur)
    return peak


@dataclass
class VehicleCandidate:
    driver_id: str
    vehicle_id: str
    seats: int
    type: str
    rating: float


def pick_vehicle_set(peak_load: int, candidates: list[VehicleCandidate]) -> list[VehicleCandidate]:
    if peak_load <= 0 or not candidates:
        return []
    buses = sorted([c for c in candidates if c.type == "bus"], key=lambda c: -c.rating)
    vans = sorted([c for c in candidates if c.type == "van"], key=lambda c: -c.rating)
    max_van_seats = max((c.seats for c in vans), default=0)

    selected: list[VehicleCandidate] = []
    total = 0
    if peak_load > max_van_seats and buses:
        selected.append(buses[0])
        total += buses[0].seats
        buses = buses[1:]

    remaining = sorted(buses + vans, key=lambda c: (-c.seats, -c.rating))
    while total < peak_load and remaining:
        pick = remaining.pop(0)
        selected.append(pick)
        total += pick.seats
    return selected


@dataclass
class Assignment:
    vehicle_idx: int
    segment: tuple[int, int]


def first_fit_assign(
    bookings_sorted: list[dict], segments: dict[str, tuple[int, int]], vehicles: list[VehicleCandidate]
) -> tuple[dict[str, int], list[dict]]:
    """Returns {booking_id: vehicle_idx} and overflow list of bookings."""
    vehicle_segments: list[list[tuple[int, int]]] = [[] for _ in vehicles]
    assignment: dict[str, int] = {}
    overflow: list[dict] = []

    for booking in bookings_sorted:
        seg = segments[booking["id"]]
        placed = False
        for vidx, vehicle in enumerate(vehicles):
            candidate_segments = vehicle_segments[vidx] + [seg]
            if compute_peak_load(candidate_segments) <= vehicle.seats:
                vehicle_segments[vidx].append(seg)
                assignment[booking["id"]] = vidx
                placed = True
                break
        if not placed:
            overflow.append(booking)
    return assignment, overflow


def build_stop_schedule(
    stops_ordered: list[dict],
    slot_departure: str,
    bookings_by_vehicle: list[dict],
    dwell_min_per_stop: float,
    peak_speed_kmh: float,
) -> list[dict]:
    hh, mm = map(int, slot_departure.split(":"))
    base_minutes = hh * 60 + mm

    pickups_at: dict[int, list[str]] = defaultdict(list)
    drops_at: dict[int, list[str]] = defaultdict(list)
    idx_map = stop_index_map(stops_ordered)
    for b in bookings_by_vehicle:
        pickups_at[idx_map[b["pickup_stop_id"]]].append(b["id"])
        drops_at[idx_map[b["drop_stop_id"]]].append(b["id"])

    schedule = []
    cumulative_dwell = 0.0
    start_km = stops_ordered[0].get("km_from_start", 0)
    for i, stop in enumerate(stops_ordered):
        has_activity = bool(pickups_at.get(i)) or bool(drops_at.get(i))
        if not has_activity:
            continue
        km_delta = abs(stop.get("km_from_start", 0) - start_km)
        travel_min = km_delta / peak_speed_kmh * 60 if peak_speed_kmh > 0 else 0
        eta_minutes = base_minutes + travel_min + cumulative_dwell
        eta_h = int(eta_minutes // 60) % 24
        eta_m = int(round(eta_minutes % 60))
        schedule.append(
            {
                "stop_id": stop["id"],
                "eta": f"{eta_h:02d}:{eta_m:02d}",
                "pickups": pickups_at.get(i, []),
                "drops": drops_at.get(i, []),
            }
        )
        cumulative_dwell += dwell_min_per_stop
    return schedule


def _slot_minutes(dep: str) -> int:
    hh, mm = map(int, dep.split(":"))
    return hh * 60 + mm


def run_matching(date: str, force: bool = False) -> dict:
    repos = get_repos()
    settings = repos.settings.all()[0] if repos.settings.all() else {}

    min_seats_van = settings.get("min_seats_van", 6)
    min_seats_bus = settings.get("min_seats_bus", 15)
    merge_window_min = settings.get("merge_window_min", 15)
    dwell_min = settings.get("dwell_min_per_stop", 1)
    peak_speed = settings.get("peak_speed_kmh", 20)
    commission_pct = settings.get("commission_pct", 12)

    target_weekday = datetime.strptime(date, "%Y-%m-%d").isoweekday()

    existing_trips = repos.trips.find(date=date)
    for trip in existing_trips:
        if trip["status"] == "planned":
            for bid in trip["booking_ids"]:
                booking = repos.bookings.get(bid)
                if booking and booking["status"] in ("confirmed",):
                    repos.bookings.update(bid, {"status": "pending", "trip_id": None})
            repos.trips.delete(trip["id"])

    pending_bookings = [b for b in repos.bookings.find(date=date) if b["status"] in ("pending", "unmatched")]
    for b in pending_bookings:
        if b["status"] == "unmatched":
            repos.bookings.update(b["id"], {"status": "pending"})

    groups: dict[tuple[str, str, str], list[dict]] = defaultdict(list)
    for b in pending_bookings:
        groups[(b["corridor_id"], b["direction"], b["slot_id"])].append(b)

    corridors = {c["id"]: c for c in repos.corridors.all()}
    stops_by_corridor: dict[str, list[dict]] = defaultdict(list)
    for s in repos.stops.all():
        stops_by_corridor[s["corridor_id"]].append(s)
    slots_by_id = {s["id"]: s for s in repos.time_slots.all()}
    drivers = [d for d in repos.drivers.all() if d["status"] == "approved"]
    vehicles_by_id = {v["id"]: v for v in repos.vehicles.all()}

    trip_candidates: dict[tuple[str, str, str], dict] = {}
    all_overflow: list[dict] = []

    for (corridor_id, direction, slot_id), group_bookings in groups.items():
        stops_ordered = direction_stop_order(stops_by_corridor[corridor_id], direction)
        idx_map = stop_index_map(stops_ordered)
        segments = {
            b["id"]: booking_segment(b["pickup_stop_id"], b["drop_stop_id"], idx_map) for b in group_bookings
        }
        sorted_bookings = sorted(group_bookings, key=lambda b: (segments[b["id"]][0], b["created_at"]))

        candidates = []
        for d in drivers:
            for avail in d.get("availability", []):
                if (
                    avail["corridor_id"] == corridor_id
                    and avail["direction"] == direction
                    and slot_id in avail.get("slot_ids", [])
                    and target_weekday in avail.get("weekdays", [1, 2, 3, 4, 5])
                ):
                    vehicle = next(
                        (v for v in vehicles_by_id.values() if v["driver_id"] == d["id"]), None
                    )
                    if vehicle:
                        candidates.append(
                            VehicleCandidate(
                                driver_id=d["id"],
                                vehicle_id=vehicle["id"],
                                seats=vehicle["seats"],
                                type=vehicle["type"],
                                rating=d.get("rating_avg", 0),
                            )
                        )
                    break

        already_used_driver_ids = {
            t["driver_id"] for t in trip_candidates.values() if t["driver_id"]
        }
        candidates = [c for c in candidates if c.driver_id not in already_used_driver_ids]

        peak_load = compute_peak_load(list(segments.values()))
        chosen_vehicles = pick_vehicle_set(peak_load, candidates)
        assignment, overflow = first_fit_assign(sorted_bookings, segments, chosen_vehicles)

        per_vehicle_bookings: list[list[dict]] = [[] for _ in chosen_vehicles]
        for b in sorted_bookings:
            if b["id"] in assignment:
                per_vehicle_bookings[assignment[b["id"]]].append(b)

        for vidx, vehicle in enumerate(chosen_vehicles):
            bookings_here = per_vehicle_bookings[vidx]
            if not bookings_here:
                continue
            key = (corridor_id, direction, slot_id, vehicle.vehicle_id)
            trip_candidates[key] = {
                "corridor_id": corridor_id,
                "direction": direction,
                "slot_id": slot_id,
                "driver_id": vehicle.driver_id,
                "vehicle_id": vehicle.vehicle_id,
                "seats": vehicle.seats,
                "vehicle_type": vehicle.type,
                "bookings": bookings_here,
            }
        all_overflow.extend(overflow)

    unmatched_count = 0
    merged_count = 0

    min_seats_for = lambda vtype: min_seats_van if vtype == "van" else min_seats_bus
    thin_keys = [
        k for k, v in trip_candidates.items() if len(v["bookings"]) < min_seats_for(v["vehicle_type"]) and not force
    ]

    for key in thin_keys:
        trip = trip_candidates.get(key)
        if not trip:
            continue
        if len(trip["bookings"]) >= min_seats_for(trip["vehicle_type"]):
            continue  # already topped up by an earlier merge in this pass
        corridor_id, direction, slot_id, vehicle_id = key
        candidate_keys = [
            k
            for k in trip_candidates
            if k != key
            and k[0] == corridor_id
            and k[1] == direction
            and abs(
                _slot_minutes(slots_by_id[k[2]]["departure_time"])
                - _slot_minutes(slots_by_id[slot_id]["departure_time"])
            )
            <= merge_window_min
        ]
        merged = False
        for ck in sorted(
            candidate_keys,
            key=lambda k: abs(
                _slot_minutes(slots_by_id[k[2]]["departure_time"])
                - _slot_minutes(slots_by_id[slot_id]["departure_time"])
            ),
        ):
            target = trip_candidates[ck]
            stops_ordered = direction_stop_order(stops_by_corridor[corridor_id], direction)
            idx_map = stop_index_map(stops_ordered)
            combined_segments = [
                booking_segment(b["pickup_stop_id"], b["drop_stop_id"], idx_map)
                for b in target["bookings"] + trip["bookings"]
            ]
            if compute_peak_load(combined_segments) <= target["seats"]:
                for b in trip["bookings"]:
                    new_slot_time = slots_by_id[ck[2]]["departure_time"]
                    notify(
                        b["passenger_id"],
                        "Ride time changed",
                        f"Your ride was merged into the {new_slot_time} departure for better availability.",
                        link=f"/rides/{b['id']}",
                    )
                target["bookings"].extend(trip["bookings"])
                del trip_candidates[key]
                merged = True
                merged_count += len(trip["bookings"])
                break
        if not merged:
            for b in trip["bookings"]:
                unmatched_count += 1
                repos.bookings.update(b["id"], {"status": "unmatched", "trip_id": None})
                repos.users.update(
                    b["passenger_id"],
                    {
                        "wallet_balance_lkr": repos.users.get(b["passenger_id"])["wallet_balance_lkr"]
                        + b["fare_snapshot"]["fare"]
                    },
                )
                repos.transactions.insert(
                    {
                        "user_id": b["passenger_id"],
                        "type": "refund",
                        "amount_lkr": b["fare_snapshot"]["fare"],
                        "booking_id": b["id"],
                        "status": "completed",
                        "note": "Refund: not enough riders for this slot",
                    }
                )
                slot_time = slots_by_id[slot_id]["departure_time"]
                notify(
                    b["passenger_id"],
                    "Ride unmatched",
                    f"Not enough riders for {slot_time} — try a nearby time. You've been refunded.",
                    link=f"/rides/{b['id']}",
                )
            del trip_candidates[key]

    for b in all_overflow:
        unmatched_count += 1
        repos.bookings.update(b["id"], {"status": "unmatched", "trip_id": None})
        user = repos.users.get(b["passenger_id"])
        repos.users.update(b["passenger_id"], {"wallet_balance_lkr": user["wallet_balance_lkr"] + b["fare_snapshot"]["fare"]})
        repos.transactions.insert(
            {
                "user_id": b["passenger_id"],
                "type": "refund",
                "amount_lkr": b["fare_snapshot"]["fare"],
                "booking_id": b["id"],
                "status": "completed",
                "note": "Refund: no vehicle capacity available",
            }
        )
        notify(b["passenger_id"], "Ride unmatched", "No vehicle capacity for your requested ride. You've been refunded.")

    trips_created = 0
    confirmed = 0
    for key, trip in trip_candidates.items():
        corridor_id, direction, slot_id = key[0], key[1], key[2]
        stops_ordered = direction_stop_order(stops_by_corridor[corridor_id], direction)
        schedule = build_stop_schedule(
            stops_ordered, slots_by_id[slot_id]["departure_time"], trip["bookings"], dwell_min, peak_speed
        )
        used_stop_ids = {s["stop_id"] for s in schedule}
        used_stops = [s for s in stops_ordered if s["id"] in used_stop_ids]
        trip_km_used = 0.0
        if len(used_stops) >= 2:
            trip_km_used = abs(used_stops[-1].get("km_from_start", 0) - used_stops[0].get("km_from_start", 0))

        distance_fares = [b["fare_snapshot"]["distance_fare"] for b in trip["bookings"]]
        booking_fees = [b["fare_snapshot"]["booking_fee"] for b in trip["bookings"]]
        passenger_km_total = sum(b["fare_snapshot"]["passenger_km"] for b in trip["bookings"])
        totals = pricing.compute_trip_totals(
            distance_fares, booking_fees, commission_pct, trip["seats"], trip_km_used, passenger_km_total
        )

        new_trip = repos.trips.insert(
            {
                "corridor_id": corridor_id,
                "direction": direction,
                "date": date,
                "slot_id": slot_id,
                "driver_id": trip["driver_id"],
                "vehicle_id": trip["vehicle_id"],
                "booking_ids": [b["id"] for b in trip["bookings"]],
                "stop_schedule": schedule,
                "status": "planned",
                "totals": totals.__dict__,
            }
        )
        trips_created += 1
        slot_time = slots_by_id[slot_id]["departure_time"]
        stop_name_by_id = {s["id"]: s["name"] for s in stops_ordered}
        for b in trip["bookings"]:
            pickup_eta = next((s["eta"] for s in schedule if b["id"] in s["pickups"]), slot_time)
            repos.bookings.update(b["id"], {"status": "confirmed", "trip_id": new_trip["id"]})
            confirmed += 1
            notify(
                b["passenger_id"],
                "Ride confirmed",
                f"Your {slot_time} ride is confirmed — pickup at {stop_name_by_id.get(b['pickup_stop_id'], '')} {pickup_eta}.",
                link=f"/rides/{b['id']}",
            )
        driver_user_id = None
        d = repos.drivers.get(trip["driver_id"])
        if d:
            driver_user_id = d["user_id"]
        if driver_user_id:
            notify(
                driver_user_id,
                "New trip assigned",
                f"New trip on {date}: {len(trip['bookings'])} passengers, est. earnings LKR {round(totals.driver_payout)}.",
                link=f"/driver/trips/{new_trip['id']}",
            )

    return {
        "trips_created": trips_created,
        "confirmed": confirmed,
        "unmatched": unmatched_count,
        "merged": merged_count,
    }
