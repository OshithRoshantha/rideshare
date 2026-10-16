from pydantic import BaseModel, Field

from app.models.common import TxnStatus, TxnType


class TopupRequest(BaseModel):
    amount_lkr: float = Field(gt=0, le=100000)


class TransactionOut(BaseModel):
    id: str
    user_id: str
    type: TxnType
    amount_lkr: float
    booking_id: str | None = None
    trip_id: str | None = None
    status: TxnStatus
    note: str = ""
    created_at: str | None = None


class WalletOut(BaseModel):
    balance: float
    transactions: list[TransactionOut]


class NotificationOut(BaseModel):
    id: str
    user_id: str
    title: str
    body: str
    read: bool = False
    link: str | None = None
    created_at: str | None = None


class SettingsModel(BaseModel):
    booking_fee_lkr: float = 20
    rate_per_km_van_lkr: float = 18
    rate_per_km_bus_lkr: float = 14
    minimum_fare_lkr: float = 150
    commission_pct: float = 12
    commute_pass_discount_pct: float = 10
    solo_ride_rate_per_km_lkr: float = 100
    max_walk_m: float = 800
    cutoff_time: str = "21:00"
    min_seats_van: int = 6
    min_seats_bus: int = 15
    dwell_min_per_stop: float = 1
    peak_speed_kmh: float = 20
    merge_window_min: int = 15
    timezone: str = "Asia/Colombo"


class SettingsUpdate(BaseModel):
    booking_fee_lkr: float | None = None
    rate_per_km_van_lkr: float | None = None
    rate_per_km_bus_lkr: float | None = None
    minimum_fare_lkr: float | None = None
    commission_pct: float | None = None
    commute_pass_discount_pct: float | None = None
    solo_ride_rate_per_km_lkr: float | None = None
    max_walk_m: float | None = None
    cutoff_time: str | None = None
    min_seats_van: int | None = None
    min_seats_bus: int | None = None
    dwell_min_per_stop: float | None = None
    peak_speed_kmh: float | None = None
    merge_window_min: int | None = None
