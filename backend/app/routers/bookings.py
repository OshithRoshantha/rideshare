import uuid

from fastapi import APIRouter, Depends, Query

from app.core.deps import get_current_user, require_role
from app.core.errors import bad_request, forbidden, not_found
from app.core.time_utils import now, today_str
from app.models.booking import BookingCreateRequest, RateRequest
from app.services.booking_logic import cancel_booking, create_scheduled_booking, get_settings
from app.services.matching import booking_segment, compute_peak_load, direction_stop_order, stop_index_map
from app.services.notifications import notify
from app.services.scheduling import dates_for_repeat
from app.storage.repositories import get_repos

router = APIRouter(prefix="/bookings", tags=["bookings"])


def _enrich(booking: dict, repos) -> dict:
    result = dict(booking)
    if booking.get("trip_id"):
        trip = repos.trips.get(booking["trip_id"])
        if trip:
            driver = repos.drivers.get(trip["driver_id"]) if trip.get("driver_id") else None
            vehicle = repos.vehicles.get(trip["vehicle_id"]) if trip.get("vehicle_id") else None
            driver_user = repos.users.get(driver["user_id"]) if driver else None
            result["trip"] = trip
            result["driver"] = (
                {
                    "full_name": driver_user["full_name"] if driver_user else None,
                    "rating_avg": driver["rating_avg"],
                }
                if driver
                else None
            )
            result["vehicle"] = vehicle
    corridor = repos.corridors.get(booking["corridor_id"])
    pickup = repos.stops.get(booking["pickup_stop_id"])
    drop = repos.stops.get(booking["drop_stop_id"])
    result["corridor"] = corridor
    result["pickup_stop"] = pickup
    result["drop_stop"] = drop
    return result


@router.post("")
def create_booking(payload: BookingCreateRequest, user: dict = Depends(require_role("passenger"))):
    repos = get_repos()
    settings = get_settings(repos)

    if payload.booking_type == "now":
        return _book_now(payload, user, repos, settings)

    dates: list[str]
    repeat_group_id = None
    if payload.booking_type == "repeat":
        if not payload.repeat:
            raise bad_request("MISSING_REPEAT", "Repeat details are required")
        dates = dates_for_repeat(payload.repeat.weekdays, payload.repeat.from_date, payload.repeat.to_date)
        if not dates:
            raise bad_request("NO_DATES", "No matching weekdays found in the selected range")
        repeat_group_id = str(uuid.uuid4())
    else:
        if not payload.date:
            raise bad_request("MISSING_DATE", "A date is required")
        dates = [payload.date]

    created = []
    for date in dates:
        booking = create_scheduled_booking(
            repos,
            user,
            payload.corridor_id,
            payload.direction,
            payload.slot_id,
            payload.pickup_stop_id,
            payload.drop_stop_id,
            payload.origin.model_dump(),
            payload.destination.model_dump(),
            date,
            payload.booking_type,
            repeat_group_id,
            settings,
        )
        created.append(booking)

    return created if payload.booking_type == "repeat" else created[0]


def _book_now(payload: BookingCreateRequest, user: dict, repos, settings: dict):
    date = today_str()
    candidates = [
        t
        for t in repos.trips.find(corridor_id=payload.corridor_id, direction=payload.direction, date=date)
        if t["status"] in ("planned", "driver_accepted", "in_progress")
    ]
    if not candidates:
        raise bad_request("NO_SEATS_NOW", "No seats right now — schedule for tomorrow instead")

    stops = repos.stops.find(corridor_id=payload.corridor_id)
    ordered = direction_stop_order(stops, payload.direction)
    idx_map = stop_index_map(ordered)
    new_seg = booking_segment(payload.pickup_stop_id, payload.drop_stop_id, idx_map)

    best_trip = None
    best_eta = None
    for trip in candidates:
        vehicle = repos.vehicles.get(trip["vehicle_id"])
        if not vehicle:
            continue
        pickup_entry = next((s for s in trip["stop_schedule"] if s["stop_id"] == payload.pickup_stop_id), None)
        eta_str = pickup_entry["eta"] if pickup_entry else None
        if eta_str:
            hh, mm = map(int, eta_str.split(":"))
            eta_dt = now().replace(hour=hh, minute=mm, second=0, microsecond=0)
            if (eta_dt - now()).total_seconds() < 5 * 60:
                continue
        existing_bookings = [b for b in repos.bookings.find(trip_id=trip["id"]) if b["status"] == "confirmed"]
        segs = [booking_segment(b["pickup_stop_id"], b["drop_stop_id"], idx_map) for b in existing_bookings]
        segs.append(new_seg)
        if compute_peak_load(segs) > vehicle["seats"]:
            continue
        if best_eta is None or (eta_str and eta_str < best_eta):
            best_trip = trip
            best_eta = eta_str

    if not best_trip:
        raise bad_request("NO_SEATS_NOW", "No seats right now — schedule for tomorrow instead")

    pickup_stop = repos.stops.get(payload.pickup_stop_id)
    drop_stop = repos.stops.get(payload.drop_stop_id)
    from app.services.booking_logic import build_fare_snapshot, charge_wallet

    fare_snapshot = build_fare_snapshot(pickup_stop, drop_stop, settings)
    fresh_user = repos.users.get(user["id"])
    charge_wallet(repos, fresh_user, fare_snapshot["fare"], "", "Fare for book-now ride")

    booking = repos.bookings.insert(
        {
            "passenger_id": user["id"],
            "corridor_id": payload.corridor_id,
            "direction": payload.direction,
            "date": date,
            "slot_id": best_trip["slot_id"],
            "pickup_stop_id": payload.pickup_stop_id,
            "drop_stop_id": payload.drop_stop_id,
            "origin": payload.origin.model_dump(),
            "destination": payload.destination.model_dump(),
            "walk_to_pickup_m": 0,
            "walk_from_drop_m": 0,
            "fare_snapshot": fare_snapshot,
            "status": "confirmed",
            "trip_id": best_trip["id"],
            "booking_type": "now",
            "repeat_group_id": None,
        }
    )
    repos.trips.update(best_trip["id"], {"booking_ids": best_trip["booking_ids"] + [booking["id"]]})
    notify(user["id"], "Ride confirmed", f"You're booked on the next available vehicle, pickup around {best_eta}.")
    return booking


@router.get("")
def list_bookings(scope: str = Query("upcoming"), user: dict = Depends(require_role("passenger"))):
    repos = get_repos()
    bookings = repos.bookings.find(passenger_id=user["id"])
    today = today_str()
    if scope == "upcoming":
        bookings = [b for b in bookings if b["date"] >= today and b["status"] in ("pending", "confirmed", "unmatched")]
    else:
        bookings = [b for b in bookings if b["date"] < today or b["status"] in ("completed", "cancelled", "no_show")]
    bookings.sort(key=lambda b: b["date"])
    return [_enrich(b, repos) for b in bookings]


@router.get("/{booking_id}")
def get_booking(booking_id: str, user: dict = Depends(get_current_user)):
    repos = get_repos()
    booking = repos.bookings.get(booking_id)
    if not booking:
        raise not_found(detail="Booking not found")
    if user["role"] == "passenger" and booking["passenger_id"] != user["id"]:
        raise forbidden()
    return _enrich(booking, repos)


@router.post("/{booking_id}/cancel")
def cancel(booking_id: str, user: dict = Depends(require_role("passenger"))):
    repos = get_repos()
    booking = repos.bookings.get(booking_id)
    if not booking or booking["passenger_id"] != user["id"]:
        raise not_found(detail="Booking not found")
    settings = get_settings(repos)
    updated = cancel_booking(repos, booking, user, settings)
    if booking.get("trip_id"):
        trip = repos.trips.get(booking["trip_id"])
        if trip:
            repos.trips.update(trip["id"], {"booking_ids": [b for b in trip["booking_ids"] if b != booking_id]})
    return updated


@router.post("/{booking_id}/rate")
def rate_booking(booking_id: str, payload: RateRequest, user: dict = Depends(require_role("passenger"))):
    repos = get_repos()
    booking = repos.bookings.get(booking_id)
    if not booking or booking["passenger_id"] != user["id"]:
        raise not_found(detail="Booking not found")
    if booking["status"] != "completed":
        raise bad_request("NOT_COMPLETED", "You can only rate completed trips")
    if repos.ratings.find_one(booking_id=booking_id):
        raise bad_request("ALREADY_RATED", "You already rated this trip")

    trip = repos.trips.get(booking["trip_id"])
    driver_id = trip["driver_id"] if trip else None
    rating = repos.ratings.insert(
        {
            "trip_id": booking.get("trip_id"),
            "booking_id": booking_id,
            "passenger_id": user["id"],
            "driver_id": driver_id,
            "stars": payload.stars,
            "comment": payload.comment,
        }
    )
    if driver_id:
        driver = repos.drivers.get(driver_id)
        new_count = driver["rating_count"] + 1
        new_avg = (driver["rating_avg"] * driver["rating_count"] + payload.stars) / new_count
        repos.drivers.update(driver_id, {"rating_avg": round(new_avg, 2), "rating_count": new_count})
    return rating
