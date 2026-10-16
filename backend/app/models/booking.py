from pydantic import BaseModel, Field

from app.models.common import BookingStatus, BookingType, Direction, NamedPoint


class FareSnapshot(BaseModel):
    passenger_km: float
    rate_per_km: float
    booking_fee: float
    distance_fare: float
    fare: float
    solo_estimate: float = 0
    savings_pct: float = 0


class RepeatSpec(BaseModel):
    weekdays: list[int]
    from_date: str
    to_date: str


class BookingCreateRequest(BaseModel):
    corridor_id: str
    direction: Direction
    slot_id: str
    pickup_stop_id: str
    drop_stop_id: str
    origin: NamedPoint
    destination: NamedPoint
    booking_type: BookingType
    date: str | None = None
    repeat: RepeatSpec | None = None


class BookingOut(BaseModel):
    id: str
    passenger_id: str
    corridor_id: str
    direction: Direction
    date: str
    slot_id: str
    pickup_stop_id: str
    drop_stop_id: str
    origin: NamedPoint
    destination: NamedPoint
    walk_to_pickup_m: float
    walk_from_drop_m: float
    fare_snapshot: FareSnapshot
    status: BookingStatus
    trip_id: str | None = None
    booking_type: BookingType
    repeat_group_id: str | None = None
    created_at: str | None = None


class RateRequest(BaseModel):
    stars: int = Field(ge=1, le=5)
    comment: str = ""


class RouteOptionsRequest(BaseModel):
    origin: NamedPoint
    destination: NamedPoint
    date: str | None = None
    direction: Direction | None = None


class RouteRequestCreate(BaseModel):
    origin: NamedPoint
    destination: NamedPoint
