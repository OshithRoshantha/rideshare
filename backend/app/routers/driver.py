from fastapi import APIRouter, Depends, Query

from app.core.deps import require_role
from app.core.errors import bad_request, not_found
from app.core.time_utils import today_str
from app.models.driver import AvailabilityUpdate, OnboardingRequest
from app.services.notifications import notify
from app.storage.repositories import get_repos

router = APIRouter(prefix="/driver", tags=["driver"])


def _get_driver_or_404(repos, user_id: str) -> dict:
    driver = repos.drivers.find_one(user_id=user_id)
    if not driver:
        raise not_found(detail="Driver profile not found")
    return driver


@router.post("/onboarding")
def onboarding(payload: OnboardingRequest, user: dict = Depends(require_role("driver"))):
    repos = get_repos()
    driver = _get_driver_or_404(repos, user["id"])
    repos.drivers.update(driver["id"], {"licence_no": payload.licence_no, "nic_no": payload.nic_no, "status": "pending"})
    vehicle = repos.vehicles.find_one(driver_id=driver["id"])
    vehicle_data = payload.vehicle.model_dump()
    if vehicle:
        repos.vehicles.update(vehicle["id"], vehicle_data)
    else:
        repos.vehicles.insert({**vehicle_data, "driver_id": driver["id"], "status": "pending"})
    return {"status": "submitted"}


def _enrich_driver(driver: dict, repos) -> dict:
    user = repos.users.get(driver["user_id"])
    vehicle = repos.vehicles.find_one(driver_id=driver["id"])
    return {**driver, "full_name": user["full_name"] if user else None, "vehicle": vehicle}


@router.get("/me")
def get_me(user: dict = Depends(require_role("driver"))):
    repos = get_repos()
    driver = _get_driver_or_404(repos, user["id"])
    return _enrich_driver(driver, repos)


@router.patch("/availability")
def update_availability(payload: AvailabilityUpdate, user: dict = Depends(require_role("driver"))):
    repos = get_repos()
    driver = _get_driver_or_404(repos, user["id"])
    availability = [a.model_dump() for a in payload.availability]
    updated = repos.drivers.update(driver["id"], {"availability": availability})
    return _enrich_driver(updated, repos)


def _enrich_trip(trip: dict, repos) -> dict:
    corridor = repos.corridors.get(trip["corridor_id"])
    slot = repos.time_slots.get(trip["slot_id"])
    bookings = [repos.bookings.get(bid) for bid in trip["booking_ids"]]
    bookings = [b for b in bookings if b]
    enriched_bookings = []
    for b in bookings:
        passenger = repos.users.get(b["passenger_id"])
        pickup = repos.stops.get(b["pickup_stop_id"])
        drop = repos.stops.get(b["drop_stop_id"])
        enriched_bookings.append(
            {
                **b,
                "passenger_first_name": passenger["full_name"].split(" ")[0] if passenger else "Passenger",
                "pickup_stop": pickup,
                "drop_stop": drop,
            }
        )
    vehicle = repos.vehicles.get(trip["vehicle_id"]) if trip.get("vehicle_id") else None
    return {**trip, "corridor": corridor, "slot": slot, "bookings": enriched_bookings, "vehicle": vehicle}


@router.get("/trips")
def list_trips(scope: str = Query("today"), user: dict = Depends(require_role("driver"))):
    repos = get_repos()
    driver = _get_driver_or_404(repos, user["id"])
    trips = repos.trips.find(driver_id=driver["id"])
    today = today_str()
    if scope == "today":
        trips = [t for t in trips if t["date"] == today]
    elif scope == "upcoming":
        trips = [t for t in trips if t["date"] >= today and t["status"] != "completed" and t["status"] != "cancelled"]
    else:
        trips = [t for t in trips if t["status"] in ("completed", "cancelled") or t["date"] < today]
    trips.sort(key=lambda t: (t["date"], t.get("slot_id", "")))
    return [_enrich_trip(t, repos) for t in trips]


def _trip_for_driver(repos, trip_id: str, user: dict) -> dict:
    driver = _get_driver_or_404(repos, user["id"])
    trip = repos.trips.get(trip_id)
    if not trip or trip["driver_id"] != driver["id"]:
        raise not_found(detail="Trip not found")
    return trip


@router.post("/trips/{trip_id}/accept")
def accept_trip(trip_id: str, user: dict = Depends(require_role("driver"))):
    repos = get_repos()
    trip = _trip_for_driver(repos, trip_id, user)
    if trip["status"] != "planned":
        raise bad_request("INVALID_STATE", "Trip cannot be accepted in its current state")
    return repos.trips.update(trip_id, {"status": "driver_accepted"})


@router.post("/trips/{trip_id}/decline")
def decline_trip(trip_id: str, user: dict = Depends(require_role("driver"))):
    repos = get_repos()
    trip = _trip_for_driver(repos, trip_id, user)
    if trip["status"] != "planned":
        raise bad_request("INVALID_STATE", "Trip cannot be declined in its current state")
    for bid in trip["booking_ids"]:
        repos.bookings.update(bid, {"status": "pending", "trip_id": None})
    return repos.trips.update(trip_id, {"status": "cancelled", "driver_id": None})


@router.post("/trips/{trip_id}/start")
def start_trip(trip_id: str, user: dict = Depends(require_role("driver"))):
    repos = get_repos()
    trip = _trip_for_driver(repos, trip_id, user)
    if trip["status"] != "driver_accepted":
        raise bad_request("INVALID_STATE", "Trip must be accepted before starting")
    return repos.trips.update(trip_id, {"status": "in_progress"})


@router.post("/trips/{trip_id}/complete")
def complete_trip(trip_id: str, user: dict = Depends(require_role("driver"))):
    repos = get_repos()
    trip = _trip_for_driver(repos, trip_id, user)
    if trip["status"] != "in_progress":
        raise bad_request("INVALID_STATE", "Trip must be in progress to complete")
    for bid in trip["booking_ids"]:
        booking = repos.bookings.get(bid)
        if booking and booking["status"] == "confirmed":
            repos.bookings.update(bid, {"status": "completed"})
    updated = repos.trips.update(trip_id, {"status": "completed"})
    driver = repos.drivers.get(trip["driver_id"])
    repos.transactions.insert(
        {
            "user_id": driver["user_id"],
            "type": "driver_payout",
            "amount_lkr": trip["totals"]["driver_payout"],
            "booking_id": None,
            "trip_id": trip_id,
            "status": "pending",
            "note": f"Payout for trip on {trip['date']}",
        }
    )
    return updated


@router.post("/trips/{trip_id}/bookings/{booking_id}/boarded")
def mark_boarded(trip_id: str, booking_id: str, user: dict = Depends(require_role("driver"))):
    repos = get_repos()
    _trip_for_driver(repos, trip_id, user)
    booking = repos.bookings.get(booking_id)
    if not booking or booking["trip_id"] != trip_id:
        raise not_found(detail="Booking not found on this trip")
    return repos.bookings.update(booking_id, {"status": "confirmed"})


@router.post("/trips/{trip_id}/bookings/{booking_id}/no-show")
def mark_no_show(trip_id: str, booking_id: str, user: dict = Depends(require_role("driver"))):
    repos = get_repos()
    _trip_for_driver(repos, trip_id, user)
    booking = repos.bookings.get(booking_id)
    if not booking or booking["trip_id"] != trip_id:
        raise not_found(detail="Booking not found on this trip")
    return repos.bookings.update(booking_id, {"status": "no_show"})


@router.get("/earnings")
def earnings(user: dict = Depends(require_role("driver"))):
    repos = get_repos()
    driver = _get_driver_or_404(repos, user["id"])
    trips = [t for t in repos.trips.find(driver_id=driver["id"]) if t["status"] == "completed"]
    txns = repos.transactions.find(user_id=user["id"], type="driver_payout")
    txn_by_trip = {t["trip_id"]: t for t in txns}

    from datetime import timedelta

    from app.core.time_utils import now

    week_start = (now() - timedelta(days=now().weekday())).strftime("%Y-%m-%d")
    last_week_start = (now() - timedelta(days=now().weekday() + 7)).strftime("%Y-%m-%d")

    this_week_total = sum(t["totals"]["driver_payout"] for t in trips if t["date"] >= week_start)
    last_week_total = sum(t["totals"]["driver_payout"] for t in trips if last_week_start <= t["date"] < week_start)

    per_trip = []
    for t in sorted(trips, key=lambda t: t["date"], reverse=True):
        txn = txn_by_trip.get(t["id"])
        per_trip.append(
            {
                "trip_id": t["id"],
                "date": t["date"],
                "passengers": t["totals"]["passengers"],
                "payout": t["totals"]["driver_payout"],
                "payout_status": txn["status"] if txn else "pending",
            }
        )

    return {"this_week": round(this_week_total), "last_week": round(last_week_total), "trips": per_trip}
