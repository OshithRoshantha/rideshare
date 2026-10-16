"""Idempotent demo data seeder. Run with: python -m app.seed [--reset]"""

import argparse
import os
import random
import shutil
import sys
from datetime import timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import get_settings
from app.core.security import hash_password
from app.core.time_utils import now
from app.services.booking_logic import build_fare_snapshot, charge_wallet
from app.services.geo import fallback_route, osrm_route
from app.services.matching import direction_stop_order, stop_index_map
from app.storage.repositories import get_repos

INBOUND_SLOTS = ["06:45", "07:00", "07:15", "07:30", "07:45"]
OUTBOUND_SLOTS = ["17:00", "17:15", "17:30", "17:45", "18:00"]

CORRIDORS = [
    {
        "name": "Kadawatha → Colombo Fort",
        "description": "Via Kiribathgoda and Peliyagoda",
        "stops": [
            ("Kadawatha", 7.0016, 79.9530),
            ("Mahara", 6.9930, 79.9440),
            ("Kiribathgoda", 6.9779, 79.9290),
            ("Kelaniya / Tyre Junction", 6.9640, 79.9130),
            ("Peliyagoda", 6.9600, 79.8890),
            ("Colombo Fort", 6.9344, 79.8428),
        ],
    },
    {
        "name": "Maharagama → Kollupitiya",
        "description": "Via Nugegoda and Bambalapitiya",
        "stops": [
            ("Maharagama", 6.8480, 79.9265),
            ("Navinna", 6.8550, 79.9140),
            ("Nugegoda", 6.8721, 79.8890),
            ("Kirulapone", 6.8790, 79.8770),
            ("Bambalapitiya", 6.8892, 79.8560),
            ("Kollupitiya", 6.9100, 79.8510),
        ],
    },
    {
        "name": "Malabe → Colombo 07",
        "description": "Via Battaramulla and Rajagiriya",
        "stops": [
            ("Malabe", 6.9061, 79.9696),
            ("Battaramulla", 6.9017, 79.9180),
            ("Rajagiriya", 6.9094, 79.8960),
            ("Borella", 6.9147, 79.8775),
            ("Colombo 07 / Town Hall", 6.9157, 79.8636),
        ],
    },
]


def reset_data(data_dir: str):
    # Clear the directory's contents rather than removing the directory itself —
    # data_dir may be a mounted volume, and rmtree-ing a mount point raises
    # "Device or resource busy".
    if os.path.exists(data_dir):
        for entry in os.listdir(data_dir):
            path = os.path.join(data_dir, entry)
            if os.path.isdir(path) and not os.path.islink(path):
                shutil.rmtree(path)
            else:
                os.remove(path)
    os.makedirs(data_dir, exist_ok=True)


def seed_settings(repos):
    if repos.settings.all():
        return
    repos.settings.insert(
        {
            "booking_fee_lkr": 20,
            "rate_per_km_van_lkr": 18,
            "rate_per_km_bus_lkr": 14,
            "minimum_fare_lkr": 150,
            "commission_pct": 12,
            "commute_pass_discount_pct": 10,
            "solo_ride_rate_per_km_lkr": 100,
            "max_walk_m": 800,
            "cutoff_time": "21:00",
            "min_seats_van": 6,
            "min_seats_bus": 15,
            "dwell_min_per_stop": 1,
            "peak_speed_kmh": 20,
            "merge_window_min": 15,
            "timezone": "Asia/Colombo",
        }
    )


def seed_corridors(repos):
    if repos.corridors.all():
        return {c["name"]: c for c in repos.corridors.all()}

    created = {}
    for spec in CORRIDORS:
        corridor = repos.corridors.insert(
            {"name": spec["name"], "description": spec["description"], "is_active": True, "polyline": [], "total_km": 0, "total_min": 0}
        )
        stop_records = []
        for i, (name, lat, lng) in enumerate(spec["stops"]):
            stop_records.append(repos.stops.insert({"corridor_id": corridor["id"], "name": name, "lat": lat, "lng": lng, "order": i, "km_from_start": 0, "min_from_start": 0}))

        coords = [(s["lat"], s["lng"]) for s in stop_records]
        try:
            route = osrm_route(coords) or fallback_route(coords)
        except Exception:
            route = fallback_route(coords)

        cumulative_km, cumulative_min = 0.0, 0.0
        total_km, total_min = route["total_km"], route["total_min"]
        for i, s in enumerate(stop_records):
            if i > 0:
                leg_km = route["legs_km"][i - 1]
                leg_min = leg_km / total_km * total_min if total_km > 0 else 0
                cumulative_km += leg_km
                cumulative_min += leg_min
            repos.stops.update(s["id"], {"km_from_start": round(cumulative_km, 2), "min_from_start": round(cumulative_min, 1)})

        repos.corridors.update(corridor["id"], {"polyline": route["polyline"], "total_km": round(total_km, 2), "total_min": round(total_min, 1)})

        for direction, slots in (("inbound", INBOUND_SLOTS), ("outbound", OUTBOUND_SLOTS)):
            for dep in slots:
                repos.time_slots.insert({"corridor_id": corridor["id"], "direction": direction, "departure_time": dep, "weekdays": [1, 2, 3, 4, 5], "is_active": True})

        created[spec["name"]] = corridor
    return created


def create_user(repos, full_name, email, phone, password, role, wallet=0):
    existing = repos.users.find_one(email=email)
    if existing:
        return existing
    return repos.users.insert(
        {
            "role": role,
            "full_name": full_name,
            "email": email,
            "phone": phone,
            "password_hash": hash_password(password),
            "saved_places": [],
            "wallet_balance_lkr": wallet,
            "is_active": True,
        }
    )


def seed_admin(repos):
    create_user(repos, "Admin User", "admin@demo.lk", "+94770000000", "Admin@123", "admin")


def seed_driver(repos, name, email, phone, vehicle_type, seats, plate, model, colour, status="approved"):
    user = create_user(repos, name, email, phone, "Driver@123", "driver")
    driver = repos.drivers.find_one(user_id=user["id"])
    if not driver:
        driver = repos.drivers.insert(
            {"user_id": user["id"], "licence_no": f"B{random.randint(1000000,9999999)}", "nic_no": f"{random.randint(100000000,999999999)}V", "status": status, "rating_avg": round(random.uniform(4.3, 5.0), 2), "rating_count": random.randint(20, 120), "availability": []}
        )
    vehicle = repos.vehicles.find_one(driver_id=driver["id"])
    if not vehicle:
        vehicle = repos.vehicles.insert({"driver_id": driver["id"], "type": vehicle_type, "seats": seats, "plate_no": plate, "model": model, "colour": colour, "has_ac": True, "status": status})
    return user, driver, vehicle


def set_driver_availability(repos, driver, corridor_id, directions, slot_ids_by_direction):
    availability = [{"corridor_id": corridor_id, "direction": d, "slot_ids": slot_ids_by_direction[d], "weekdays": [1, 2, 3, 4, 5]} for d in directions]
    repos.drivers.update(driver["id"], {"availability": driver.get("availability", []) + availability})


def seed_drivers_and_vehicles(repos, corridors_by_name):
    corridor_a = corridors_by_name["Kadawatha → Colombo Fort"]
    corridor_b = corridors_by_name["Maharagama → Kollupitiya"]
    corridor_c = corridors_by_name["Malabe → Colombo 07"]

    def slots_for(corridor_id, direction):
        return [s["id"] for s in repos.time_slots.find(corridor_id=corridor_id, direction=direction)]

    _, driver1, _ = seed_driver(repos, "Nimal Perera", "driver1@demo.lk", "+94771111111", "van", 14, "WP CAB-1234", "Toyota HiAce", "White")
    set_driver_availability(repos, driver1, corridor_a["id"], ["inbound", "outbound"], {"inbound": slots_for(corridor_a["id"], "inbound"), "outbound": slots_for(corridor_a["id"], "outbound")})

    _, driver2, _ = seed_driver(repos, "Kamal Silva", "driver2@demo.lk", "+94772222222", "van", 14, "WP CAC-5678", "Nissan Caravan", "Silver")
    set_driver_availability(repos, driver2, corridor_b["id"], ["inbound", "outbound"], {"inbound": slots_for(corridor_b["id"], "inbound"), "outbound": slots_for(corridor_b["id"], "outbound")})

    _, driver3, _ = seed_driver(repos, "Sunil Fernando", "driver3@demo.lk", "+94773333333", "bus", 28, "WP NA-9012", "Ashok Leyland", "Blue")
    set_driver_availability(repos, driver3, corridor_c["id"], ["inbound", "outbound"], {"inbound": slots_for(corridor_c["id"], "inbound"), "outbound": slots_for(corridor_c["id"], "outbound")})

    seed_driver(repos, "Ruwan Jayasuriya", "driver4@demo.lk", "+94774444444", "van", 14, "WP CAD-3456", "Toyota KDH", "White", status="pending")

    # extra background drivers for richer matching demo (not advertised demo accounts)
    extras = [
        ("Extra Driver A1", "extra.a1@demo.lk", "+94775550001", corridor_a, "van", 14, "WP CAE-1001"),
        ("Extra Driver B1", "extra.b1@demo.lk", "+94775550002", corridor_b, "van", 14, "WP CAE-1002"),
        ("Extra Driver C1", "extra.c1@demo.lk", "+94775550003", corridor_c, "van", 14, "WP CAE-1003"),
    ]
    for name, email, phone, corridor, vtype, seats, plate in extras:
        _, drv, _ = seed_driver(repos, name, email, phone, vtype, seats, plate, "Toyota HiAce", "Grey")
        set_driver_availability(repos, drv, corridor["id"], ["inbound", "outbound"], {"inbound": slots_for(corridor["id"], "inbound"), "outbound": slots_for(corridor["id"], "outbound")})


def seed_passengers_and_bookings(repos, corridors_by_name):
    corridor_list = list(corridors_by_name.values())
    settings = repos.settings.all()[0]
    from app.services.scheduling import next_weekdays

    tomorrow = next_weekdays(1)[0]

    stops_by_corridor = {c["id"]: sorted(repos.stops.find(corridor_id=c["id"]), key=lambda s: s["order"]) for c in corridor_list}
    inbound_slots_by_corridor = {c["id"]: sorted(repos.time_slots.find(corridor_id=c["id"], direction="inbound"), key=lambda s: s["departure_time"]) for c in corridor_list}
    outbound_slots_by_corridor = {c["id"]: sorted(repos.time_slots.find(corridor_id=c["id"], direction="outbound"), key=lambda s: s["departure_time"]) for c in corridor_list}

    passengers = []
    for i in range(1, 21):
        email = f"passenger{i}@demo.lk"
        user = create_user(repos, f"Passenger {i}", email, f"+9477600{i:04d}", "Pass@123", "passenger", wallet=5000)
        passengers.append(user)

    outbound_pattern = [0, 1, 2, 3, 4]
    for idx, user in enumerate(passengers):
        corridor = corridor_list[idx % len(corridor_list)]
        stops = stops_by_corridor[corridor["id"]]
        n = len(stops)
        home_idx = random.choice(range(0, max(1, n // 3)))
        office_idx = random.choice(range(n - max(1, n // 3), n))
        if home_idx >= office_idx:
            home_idx, office_idx = 0, n - 1
        home_stop, office_stop = stops[home_idx], stops[office_idx]

        if not repos.users.get(user["id"]).get("saved_places"):
            repos.users.update(
                user["id"],
                {
                    "saved_places": [
                        {"label": "Home", "name": home_stop["name"], "lat": home_stop["lat"], "lng": home_stop["lng"]},
                        {"label": "Office", "name": office_stop["name"], "lat": office_stop["lat"], "lng": office_stop["lng"]},
                    ]
                },
            )

        in_slots = inbound_slots_by_corridor[corridor["id"]]
        out_slots = outbound_slots_by_corridor[corridor["id"]]
        popular_inbound = in_slots[2]
        chosen_outbound = out_slots[outbound_pattern[idx % len(outbound_pattern)]]

        for direction, slot, pickup_stop, drop_stop in (
            ("inbound", popular_inbound, home_stop, office_stop),
            ("outbound", chosen_outbound, office_stop, home_stop),
        ):
            existing = [
                b
                for b in repos.bookings.find(passenger_id=user["id"], date=tomorrow, direction=direction, slot_id=slot["id"])
            ]
            if existing:
                continue
            fare_snapshot = build_fare_snapshot(pickup_stop, drop_stop, settings)
            fresh_user = repos.users.get(user["id"])
            if fresh_user["wallet_balance_lkr"] < fare_snapshot["fare"]:
                continue
            charge_wallet(repos, fresh_user, fare_snapshot["fare"], "", f"Fare for {tomorrow} ride")
            repos.bookings.insert(
                {
                    "passenger_id": user["id"],
                    "corridor_id": corridor["id"],
                    "direction": direction,
                    "date": tomorrow,
                    "slot_id": slot["id"],
                    "pickup_stop_id": pickup_stop["id"],
                    "drop_stop_id": drop_stop["id"],
                    "origin": {"name": pickup_stop["name"], "lat": pickup_stop["lat"], "lng": pickup_stop["lng"]},
                    "destination": {"name": drop_stop["name"], "lat": drop_stop["lat"], "lng": drop_stop["lng"]},
                    "walk_to_pickup_m": random.randint(50, 400),
                    "walk_from_drop_m": random.randint(50, 400),
                    "fare_snapshot": fare_snapshot,
                    "status": "pending",
                    "trip_id": None,
                    "booking_type": "scheduled",
                    "repeat_group_id": None,
                }
            )
    return passengers


def seed_past_history(repos, corridors_by_name, passengers):
    settings = repos.settings.all()[0]
    corridor_list = list(corridors_by_name.values())
    drivers = [d for d in repos.drivers.all() if d["status"] == "approved"]
    if not drivers or not passengers:
        return

    for days_ago in (3, 5, 8):
        past_date = (now() - timedelta(days=days_ago)).strftime("%Y-%m-%d")
        for corridor in corridor_list:
            stops = sorted(repos.stops.find(corridor_id=corridor["id"]), key=lambda s: s["order"])
            slots = sorted(repos.time_slots.find(corridor_id=corridor["id"], direction="inbound"), key=lambda s: s["departure_time"])
            if not slots or len(stops) < 2:
                continue
            driver = next((d for d in drivers if any(a["corridor_id"] == corridor["id"] for a in d.get("availability", []))), drivers[0])
            vehicle = repos.vehicles.find_one(driver_id=driver["id"])
            if not vehicle:
                continue
            slot = slots[2]
            chosen_passengers = random.sample(passengers, k=min(6, len(passengers)))
            booking_ids = []
            distance_fares, booking_fees, passenger_km_total = [], [], 0.0
            for p in chosen_passengers:
                home_idx = 0
                office_idx = len(stops) - 1
                pickup_stop, drop_stop = stops[home_idx], stops[office_idx]
                fare_snapshot = build_fare_snapshot(pickup_stop, drop_stop, settings)
                booking = repos.bookings.insert(
                    {
                        "passenger_id": p["id"],
                        "corridor_id": corridor["id"],
                        "direction": "inbound",
                        "date": past_date,
                        "slot_id": slot["id"],
                        "pickup_stop_id": pickup_stop["id"],
                        "drop_stop_id": drop_stop["id"],
                        "origin": {"name": pickup_stop["name"], "lat": pickup_stop["lat"], "lng": pickup_stop["lng"]},
                        "destination": {"name": drop_stop["name"], "lat": drop_stop["lat"], "lng": drop_stop["lng"]},
                        "walk_to_pickup_m": 150,
                        "walk_from_drop_m": 150,
                        "fare_snapshot": fare_snapshot,
                        "status": "completed",
                        "trip_id": None,
                        "booking_type": "scheduled",
                        "repeat_group_id": None,
                    }
                )
                booking_ids.append(booking["id"])
                distance_fares.append(fare_snapshot["distance_fare"])
                booking_fees.append(fare_snapshot["booking_fee"])
                passenger_km_total += fare_snapshot["passenger_km"]

            from app.services import pricing as pricing_service

            totals = pricing_service.compute_trip_totals(
                distance_fares, booking_fees, settings["commission_pct"], vehicle["seats"], stops[-1]["km_from_start"], passenger_km_total
            )
            trip = repos.trips.insert(
                {
                    "corridor_id": corridor["id"],
                    "direction": "inbound",
                    "date": past_date,
                    "slot_id": slot["id"],
                    "driver_id": driver["id"],
                    "vehicle_id": vehicle["id"],
                    "booking_ids": booking_ids,
                    "stop_schedule": [],
                    "status": "completed",
                    "totals": totals.__dict__,
                }
            )
            for bid in booking_ids:
                repos.bookings.update(bid, {"trip_id": trip["id"]})
            repos.transactions.insert(
                {
                    "user_id": driver["user_id"],
                    "type": "driver_payout",
                    "amount_lkr": totals.driver_payout,
                    "booking_id": None,
                    "trip_id": trip["id"],
                    "status": random.choice(["completed", "pending"]),
                    "note": f"Payout for trip on {past_date}",
                }
            )
            for bid in random.sample(booking_ids, k=min(3, len(booking_ids))):
                booking = repos.bookings.get(bid)
                if repos.ratings.find_one(booking_id=bid):
                    continue
                stars = random.choice([4, 4, 5, 5, 5, 3])
                repos.ratings.insert({"trip_id": trip["id"], "booking_id": bid, "passenger_id": booking["passenger_id"], "driver_id": driver["id"], "stars": stars, "comment": "Good ride, on time."})
            new_count = driver["rating_count"]
            repos.drivers.update(driver["id"], {})


def run_seed(reset: bool):
    settings = get_settings()
    if reset:
        reset_data(settings.data_dir)

    get_repos.cache_clear()
    from app.storage.repositories import get_repos as _get_repos

    repos = _get_repos()

    seed_settings(repos)
    corridors_by_name = seed_corridors(repos)
    seed_drivers_and_vehicles(repos, corridors_by_name)
    seed_admin(repos)
    passengers = seed_passengers_and_bookings(repos, corridors_by_name)
    seed_past_history(repos, corridors_by_name, passengers)

    print("Seed complete.")
    print(f"  Corridors: {len(repos.corridors.all())}")
    print(f"  Stops: {len(repos.stops.all())}")
    print(f"  Time slots: {len(repos.time_slots.all())}")
    print(f"  Users: {len(repos.users.all())}")
    print(f"  Drivers: {len(repos.drivers.all())}")
    print(f"  Bookings: {len(repos.bookings.all())}")
    print(f"  Trips: {len(repos.trips.all())}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true")
    args = parser.parse_args()
    run_seed(args.reset)
