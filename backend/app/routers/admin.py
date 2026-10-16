from fastapi import APIRouter, Depends, Query

from app.core.deps import require_role
from app.core.errors import bad_request, not_found
from app.models.corridor import CorridorIn, StopIn, TimeSlotIn
from app.models.misc import SettingsUpdate
from app.services.geo import fallback_route, osrm_route
from app.services.matching import run_matching
from app.services.notifications import notify
from app.storage.repositories import get_repos

router = APIRouter(prefix="/admin", tags=["admin"])
admin_only = Depends(require_role("admin"))


@router.get("/dashboard")
def dashboard(date: str, user: dict = Depends(require_role("admin"))):
    repos = get_repos()
    bookings = repos.bookings.find(date=date)
    trips = repos.trips.find(date=date)
    confirmed = [b for b in bookings if b["status"] == "confirmed"]
    unmatched = [b for b in bookings if b["status"] == "unmatched"]
    occupancy_by_corridor: dict[str, list[float]] = {}
    revenue = 0.0
    payouts = 0.0
    for t in trips:
        occupancy_by_corridor.setdefault(t["corridor_id"], []).append(t["totals"].get("occupancy_pct", 0))
        revenue += t["totals"].get("company_revenue", 0)
        payouts += t["totals"].get("driver_payout", 0)

    corridors = {c["id"]: c for c in repos.corridors.all()}
    occupancy_chart = [
        {
            "corridor_id": cid,
            "corridor_name": corridors.get(cid, {}).get("name", cid),
            "avg_occupancy_pct": round(sum(vals) / len(vals), 1) if vals else 0,
        }
        for cid, vals in occupancy_by_corridor.items()
    ]
    avg_occupancy = (
        round(sum(t["totals"].get("occupancy_pct", 0) for t in trips) / len(trips), 1) if trips else 0
    )

    route_requests = repos.route_requests.all()
    heatmap = [
        {"lat": r["origin"]["lat"], "lng": r["origin"]["lng"]}
        for r in route_requests
    ]

    return {
        "date": date,
        "bookings_total": len(bookings),
        "confirmed": len(confirmed),
        "unmatched": len(unmatched),
        "trips": len(trips),
        "avg_occupancy_pct": avg_occupancy,
        "revenue_lkr": round(revenue),
        "driver_payouts_lkr": round(payouts),
        "occupancy_by_corridor": occupancy_chart,
        "route_requests_heatmap": heatmap,
    }


@router.get("/corridors")
def list_corridors(user: dict = Depends(require_role("admin"))):
    repos = get_repos()
    result = []
    for c in repos.corridors.all():
        stops = sorted(repos.stops.find(corridor_id=c["id"]), key=lambda s: s["order"])
        slots = repos.time_slots.find(corridor_id=c["id"])
        result.append({**c, "stops": stops, "slots": slots})
    return result


@router.post("/corridors")
def create_corridor(payload: CorridorIn, user: dict = Depends(require_role("admin"))):
    repos = get_repos()
    return repos.corridors.insert({**payload.model_dump(), "polyline": [], "total_km": 0, "total_min": 0})


@router.patch("/corridors/{corridor_id}")
def update_corridor(corridor_id: str, payload: CorridorIn, user: dict = Depends(require_role("admin"))):
    repos = get_repos()
    updated = repos.corridors.update(corridor_id, payload.model_dump())
    if not updated:
        raise not_found(detail="Corridor not found")
    return updated


@router.delete("/corridors/{corridor_id}")
def delete_corridor(corridor_id: str, user: dict = Depends(require_role("admin"))):
    repos = get_repos()
    repos.corridors.delete(corridor_id)
    return {"deleted": True}


@router.post("/corridors/{corridor_id}/recompute")
def recompute_corridor(corridor_id: str, user: dict = Depends(require_role("admin"))):
    repos = get_repos()
    corridor = repos.corridors.get(corridor_id)
    if not corridor:
        raise not_found(detail="Corridor not found")
    stops = sorted(repos.stops.find(corridor_id=corridor_id), key=lambda s: s["order"])
    if len(stops) < 2:
        raise bad_request("NOT_ENOUGH_STOPS", "Need at least 2 stops to compute a route")

    coords = [(s["lat"], s["lng"]) for s in stops]
    route = osrm_route(coords) or fallback_route(coords)

    cumulative_km = 0.0
    cumulative_min = 0.0
    total_km = route["total_km"]
    total_min = route["total_min"]
    for i, stop in enumerate(stops):
        if i > 0:
            leg_km = route["legs_km"][i - 1]
            leg_min = leg_km / total_km * total_min if total_km > 0 else 0
            cumulative_km += leg_km
            cumulative_min += leg_min
        repos.stops.update(stop["id"], {"km_from_start": round(cumulative_km, 2), "min_from_start": round(cumulative_min, 1)})

    repos.corridors.update(
        corridor_id, {"polyline": route["polyline"], "total_km": round(total_km, 2), "total_min": round(total_min, 1)}
    )
    return {"status": "recomputed", "total_km": round(total_km, 2), "total_min": round(total_min, 1)}


@router.get("/stops")
def list_stops(corridor_id: str, user: dict = Depends(require_role("admin"))):
    repos = get_repos()
    return sorted(repos.stops.find(corridor_id=corridor_id), key=lambda s: s["order"])


@router.post("/stops")
def create_stop(payload: StopIn, corridor_id: str, user: dict = Depends(require_role("admin"))):
    repos = get_repos()
    return repos.stops.insert({**payload.model_dump(), "corridor_id": corridor_id, "km_from_start": 0, "min_from_start": 0})


@router.patch("/stops/{stop_id}")
def update_stop(stop_id: str, payload: StopIn, user: dict = Depends(require_role("admin"))):
    repos = get_repos()
    updated = repos.stops.update(stop_id, payload.model_dump())
    if not updated:
        raise not_found(detail="Stop not found")
    return updated


@router.delete("/stops/{stop_id}")
def delete_stop(stop_id: str, user: dict = Depends(require_role("admin"))):
    repos = get_repos()
    repos.stops.delete(stop_id)
    return {"deleted": True}


@router.get("/time-slots")
def list_time_slots(corridor_id: str, user: dict = Depends(require_role("admin"))):
    repos = get_repos()
    return repos.time_slots.find(corridor_id=corridor_id)


@router.post("/time-slots")
def create_time_slot(payload: TimeSlotIn, user: dict = Depends(require_role("admin"))):
    repos = get_repos()
    return repos.time_slots.insert(payload.model_dump())


@router.patch("/time-slots/{slot_id}")
def update_time_slot(slot_id: str, payload: TimeSlotIn, user: dict = Depends(require_role("admin"))):
    repos = get_repos()
    updated = repos.time_slots.update(slot_id, payload.model_dump())
    if not updated:
        raise not_found(detail="Time slot not found")
    return updated


@router.delete("/time-slots/{slot_id}")
def delete_time_slot(slot_id: str, user: dict = Depends(require_role("admin"))):
    repos = get_repos()
    repos.time_slots.delete(slot_id)
    return {"deleted": True}


@router.get("/drivers")
def list_drivers(status: str | None = Query(None), user: dict = Depends(require_role("admin"))):
    repos = get_repos()
    drivers = repos.drivers.find(status=status) if status else repos.drivers.all()
    result = []
    for d in drivers:
        u = repos.users.get(d["user_id"])
        vehicle = repos.vehicles.find_one(driver_id=d["id"])
        result.append({**d, "full_name": u["full_name"] if u else None, "email": u["email"] if u else None, "phone": u["phone"] if u else None, "vehicle": vehicle})
    return result


@router.post("/drivers/{driver_id}/approve")
def approve_driver(driver_id: str, user: dict = Depends(require_role("admin"))):
    repos = get_repos()
    driver = repos.drivers.update(driver_id, {"status": "approved"})
    if not driver:
        raise not_found(detail="Driver not found")
    vehicle = repos.vehicles.find_one(driver_id=driver_id)
    if vehicle:
        repos.vehicles.update(vehicle["id"], {"status": "approved"})
    notify(driver["user_id"], "You're approved!", "Your driver application has been approved. Set your availability to start driving.")
    return driver


@router.post("/drivers/{driver_id}/reject")
def reject_driver(driver_id: str, user: dict = Depends(require_role("admin"))):
    repos = get_repos()
    driver = repos.drivers.update(driver_id, {"status": "rejected"})
    if not driver:
        raise not_found(detail="Driver not found")
    notify(driver["user_id"], "Application update", "Your driver application was not approved at this time.")
    return driver


@router.post("/drivers/{driver_id}/suspend")
def suspend_driver(driver_id: str, user: dict = Depends(require_role("admin"))):
    repos = get_repos()
    driver = repos.drivers.update(driver_id, {"status": "suspended"})
    if not driver:
        raise not_found(detail="Driver not found")
    notify(driver["user_id"], "Account suspended", "Your driver account has been suspended. Contact support for details.")
    return driver


@router.get("/bookings")
def list_bookings(
    date: str | None = Query(None),
    status: str | None = Query(None),
    corridor_id: str | None = Query(None),
    user: dict = Depends(require_role("admin")),
):
    repos = get_repos()
    bookings = repos.bookings.all()
    if date:
        bookings = [b for b in bookings if b["date"] == date]
    if status:
        bookings = [b for b in bookings if b["status"] == status]
    if corridor_id:
        bookings = [b for b in bookings if b["corridor_id"] == corridor_id]
    return bookings


@router.get("/trips")
def list_trips(date: str | None = Query(None), user: dict = Depends(require_role("admin"))):
    repos = get_repos()
    trips = repos.trips.find(date=date) if date else repos.trips.all()
    result = []
    for t in trips:
        driver = repos.drivers.get(t["driver_id"]) if t.get("driver_id") else None
        driver_user = repos.users.get(driver["user_id"]) if driver else None
        vehicle = repos.vehicles.get(t["vehicle_id"]) if t.get("vehicle_id") else None
        result.append({**t, "driver_name": driver_user["full_name"] if driver_user else None, "vehicle": vehicle})
    return result


@router.patch("/trips/{trip_id}")
def update_trip(trip_id: str, payload: dict, user: dict = Depends(require_role("admin"))):
    repos = get_repos()
    trip = repos.trips.get(trip_id)
    if not trip:
        raise not_found(detail="Trip not found")
    allowed = {"driver_id", "vehicle_id", "status"}
    patch = {k: v for k, v in payload.items() if k in allowed}
    updated = repos.trips.update(trip_id, patch)
    if patch.get("status") == "cancelled":
        for bid in trip["booking_ids"]:
            repos.bookings.update(bid, {"status": "pending", "trip_id": None})
    return updated


@router.post("/matching/run")
def run_matching_endpoint(payload: dict, user: dict = Depends(require_role("admin"))):
    date = payload.get("date")
    force = payload.get("force", False)
    if not date:
        raise bad_request("MISSING_DATE", "A date is required")
    return run_matching(date, force=force)


@router.get("/settings")
def get_settings_endpoint(user: dict = Depends(require_role("admin"))):
    repos = get_repos()
    items = repos.settings.all()
    return items[0] if items else {}


@router.patch("/settings")
def update_settings(payload: SettingsUpdate, user: dict = Depends(require_role("admin"))):
    repos = get_repos()
    items = repos.settings.all()
    patch = payload.model_dump(exclude_none=True)
    if items:
        return repos.settings.update(items[0]["id"], patch)
    return repos.settings.insert(patch)


@router.post("/payouts/{transaction_id}/mark-paid")
def mark_paid(transaction_id: str, user: dict = Depends(require_role("admin"))):
    repos = get_repos()
    txn = repos.transactions.update(transaction_id, {"status": "completed"})
    if not txn:
        raise not_found(detail="Transaction not found")
    return txn
