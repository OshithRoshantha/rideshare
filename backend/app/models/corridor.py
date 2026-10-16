from pydantic import BaseModel

from app.models.common import Direction


class StopIn(BaseModel):
    name: str
    lat: float
    lng: float
    order: int


class StopOut(StopIn):
    id: str
    corridor_id: str
    km_from_start: float = 0
    min_from_start: float = 0


class TimeSlotIn(BaseModel):
    corridor_id: str
    direction: Direction
    departure_time: str
    weekdays: list[int] = [1, 2, 3, 4, 5]
    is_active: bool = True


class TimeSlotOut(TimeSlotIn):
    id: str


class CorridorIn(BaseModel):
    name: str
    description: str = ""
    is_active: bool = True


class CorridorOut(CorridorIn):
    id: str
    polyline: list[list[float]] = []
    total_km: float = 0
    total_min: float = 0
    stops: list[StopOut] = []
    slots: list[TimeSlotOut] = []
