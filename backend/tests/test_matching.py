from app.services.matching import (
    VehicleCandidate,
    booking_segment,
    compute_peak_load,
    direction_stop_order,
    first_fit_assign,
    pick_vehicle_set,
    run_matching,
    stop_index_map,
)


def make_stops():
    return [
        {"id": "s0", "name": "A", "lat": 0, "lng": 0, "order": 0, "km_from_start": 0, "min_from_start": 0},
        {"id": "s1", "name": "B", "lat": 0, "lng": 0, "order": 1, "km_from_start": 5, "min_from_start": 10},
        {"id": "s2", "name": "C", "lat": 0, "lng": 0, "order": 2, "km_from_start": 10, "min_from_start": 20},
        {"id": "s3", "name": "D", "lat": 0, "lng": 0, "order": 3, "km_from_start": 15, "min_from_start": 30},
    ]


def test_outbound_direction_reversal():
    stops = make_stops()
    inbound = direction_stop_order(stops, "inbound")
    outbound = direction_stop_order(stops, "outbound")
    assert [s["id"] for s in inbound] == ["s0", "s1", "s2", "s3"]
    assert [s["id"] for s in outbound] == ["s3", "s2", "s1", "s0"]


def test_seat_reuse_after_alighting():
    # booking1 occupies [0,1), booking2 occupies [1,3) -> no overlap, 1 seat enough
    segments = [(0, 1), (1, 3)]
    assert compute_peak_load(segments) == 1


def test_peak_load_with_overlap():
    segments = [(0, 2), (1, 3)]
    assert compute_peak_load(segments) == 2


def test_first_fit_overflow_creates_second_vehicle():
    stops = make_stops()
    idx_map = stop_index_map(stops)
    bookings = [{"id": f"b{i}", "created_at": str(i)} for i in range(5)]
    segments = {b["id"]: (0, 3) for b in bookings}  # all overlap fully
    vehicles = [
        VehicleCandidate(driver_id="d1", vehicle_id="v1", seats=2, type="van", rating=5),
        VehicleCandidate(driver_id="d2", vehicle_id="v2", seats=3, type="van", rating=5),
    ]
    assignment, overflow = first_fit_assign(bookings, segments, vehicles)
    assert len(overflow) == 0
    # 2 in first vehicle, 3 in second
    v1_count = sum(1 for v in assignment.values() if v == 0)
    v2_count = sum(1 for v in assignment.values() if v == 1)
    assert v1_count == 2
    assert v2_count == 3


def test_pick_vehicle_set_prefers_bus_over_many_vans():
    candidates = [
        VehicleCandidate(driver_id="d1", vehicle_id="v1", seats=14, type="van", rating=4.5),
        VehicleCandidate(driver_id="d2", vehicle_id="v2", seats=28, type="bus", rating=4.8),
    ]
    chosen = pick_vehicle_set(peak_load=20, candidates=candidates)
    assert any(c.type == "bus" for c in chosen)


def _setup_corridor(repos):
    corridor = repos.corridors.insert({"name": "Test Corridor", "description": "", "is_active": True, "polyline": [], "total_km": 15, "total_min": 30})
    stops = []
    for s in make_stops():
        stops.append(repos.stops.insert({**{k: v for k, v in s.items() if k != "id"}, "corridor_id": corridor["id"]}))
    slot = repos.time_slots.insert({"corridor_id": corridor["id"], "direction": "inbound", "departure_time": "07:00", "weekdays": [1, 2, 3, 4, 5], "is_active": True})
    slot2 = repos.time_slots.insert({"corridor_id": corridor["id"], "direction": "inbound", "departure_time": "07:10", "weekdays": [1, 2, 3, 4, 5], "is_active": True})
    repos.settings.insert(
        {
            "booking_fee_lkr": 20, "rate_per_km_van_lkr": 18, "rate_per_km_bus_lkr": 14, "minimum_fare_lkr": 150,
            "commission_pct": 12, "commute_pass_discount_pct": 10, "solo_ride_rate_per_km_lkr": 100, "max_walk_m": 800,
            "cutoff_time": "21:00", "min_seats_van": 2, "min_seats_bus": 15, "dwell_min_per_stop": 1,
            "peak_speed_kmh": 20, "merge_window_min": 15, "timezone": "Asia/Colombo",
        }
    )
    return corridor, stops, slot, slot2


def _make_passenger(repos, name):
    return repos.users.insert({"role": "passenger", "full_name": name, "email": f"{name}@test.lk", "phone": "077", "password_hash": "x", "saved_places": [], "wallet_balance_lkr": 5000, "is_active": True})


def _make_booking(repos, passenger, corridor, slot, pickup, drop, date, direction="inbound"):
    fresh = repos.users.get(passenger["id"])
    repos.users.update(passenger["id"], {"wallet_balance_lkr": fresh["wallet_balance_lkr"] - 200})
    return repos.bookings.insert(
        {
            "passenger_id": passenger["id"], "corridor_id": corridor["id"], "direction": direction, "date": date,
            "slot_id": slot["id"], "pickup_stop_id": pickup["id"], "drop_stop_id": drop["id"],
            "origin": {"name": pickup["name"], "lat": 0, "lng": 0}, "destination": {"name": drop["name"], "lat": 0, "lng": 0},
            "walk_to_pickup_m": 100, "walk_from_drop_m": 100,
            "fare_snapshot": {"passenger_km": 10, "rate_per_km": 18, "booking_fee": 20, "distance_fare": 180, "fare": 200, "solo_estimate": 1000, "savings_pct": 80},
            "status": "pending", "trip_id": None, "booking_type": "scheduled", "repeat_group_id": None,
        }
    )


def _make_driver_with_van(repos, corridor, slot_ids, direction="inbound", seats=14):
    user = repos.users.insert({"role": "driver", "full_name": "D", "email": f"d{slot_ids}@test.lk", "phone": "077", "password_hash": "x", "saved_places": [], "wallet_balance_lkr": 0, "is_active": True})
    driver = repos.drivers.insert({"user_id": user["id"], "licence_no": "L1", "nic_no": "N1", "status": "approved", "rating_avg": 4.5, "rating_count": 10, "availability": [{"corridor_id": corridor["id"], "direction": direction, "slot_ids": slot_ids, "weekdays": [1, 2, 3, 4, 5]}]})
    vehicle = repos.vehicles.insert({"driver_id": driver["id"], "type": "van", "seats": seats, "plate_no": "P1", "model": "M", "colour": "White", "has_ac": True, "status": "approved"})
    return driver, vehicle


def test_unmatched_refund_when_no_vehicle(repos):
    corridor, stops, slot, slot2 = _setup_corridor(repos)
    passenger = _make_passenger(repos, "p1")
    booking = _make_booking(repos, passenger, corridor, slot, stops[0], stops[3], "2099-01-01")
    result = run_matching("2099-01-01")
    assert result["unmatched"] == 1
    updated_booking = repos.bookings.get(booking["id"])
    assert updated_booking["status"] == "unmatched"
    updated_user = repos.users.get(passenger["id"])
    assert updated_user["wallet_balance_lkr"] == 5000  # refunded back to original


def test_merge_into_adjacent_slot(repos):
    corridor, stops, slot, slot2 = _setup_corridor(repos)
    _make_driver_with_van(repos, corridor, [slot["id"]])
    _make_driver_with_van(repos, corridor, [slot2["id"]])
    p1 = _make_passenger(repos, "p1")
    p2 = _make_passenger(repos, "p2")
    _make_booking(repos, p1, corridor, slot, stops[0], stops[3], "2099-01-01")
    _make_booking(repos, p2, corridor, slot2, stops[0], stops[3], "2099-01-01")
    result = run_matching("2099-01-01")
    assert result["trips_created"] == 1
    assert result["merged"] >= 1
    trips = repos.trips.find(date="2099-01-01")
    assert len(trips) == 1
    assert len(trips[0]["booking_ids"]) == 2


def test_idempotent_rerun(repos):
    corridor, stops, slot, slot2 = _setup_corridor(repos)
    driver, vehicle = _make_driver_with_van(repos, corridor, [slot["id"]])
    passengers = [_make_passenger(repos, f"p{i}") for i in range(3)]
    for p in passengers:
        _make_booking(repos, p, corridor, slot, stops[0], stops[3], "2099-01-02")
    result1 = run_matching("2099-01-02")
    trips1 = repos.trips.find(date="2099-01-02")
    assert len(trips1) == 1
    result2 = run_matching("2099-01-02")
    trips2 = repos.trips.find(date="2099-01-02")
    assert len(trips2) == 1
    assert trips2[0]["booking_ids"] == trips1[0]["booking_ids"] or set(trips2[0]["booking_ids"]) == set(trips1[0]["booking_ids"])


def test_rerun_does_not_touch_accepted_trip(repos):
    corridor, stops, slot, slot2 = _setup_corridor(repos)
    driver, vehicle = _make_driver_with_van(repos, corridor, [slot["id"]])
    passengers = [_make_passenger(repos, f"q{i}") for i in range(3)]
    for p in passengers:
        _make_booking(repos, p, corridor, slot, stops[0], stops[3], "2099-01-05")
    run_matching("2099-01-05")
    trip = repos.trips.find(date="2099-01-05")[0]
    repos.trips.update(trip["id"], {"status": "driver_accepted"})
    run_matching("2099-01-05")
    trip_after = repos.trips.get(trip["id"])
    assert trip_after["status"] == "driver_accepted"
    assert len(repos.trips.find(date="2099-01-05")) == 1
