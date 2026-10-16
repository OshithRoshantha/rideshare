from pydantic import BaseModel

from app.models.common import Direction, TripStatus


class StopScheduleItem(BaseModel):
    stop_id: str
    eta: str
    pickups: list[str] = []
    drops: list[str] = []


class TripTotals(BaseModel):
    passengers: int = 0
    passenger_km: float = 0
    distance_fares: float = 0
    booking_fees: float = 0
    commission: float = 0
    driver_payout: float = 0
    company_revenue: float = 0
    occupancy_pct: float = 0


class TripOut(BaseModel):
    id: str
    corridor_id: str
    direction: Direction
    date: str
    slot_id: str
    driver_id: str | None = None
    vehicle_id: str | None = None
    booking_ids: list[str] = []
    stop_schedule: list[StopScheduleItem] = []
    status: TripStatus
    totals: TripTotals = TripTotals()
