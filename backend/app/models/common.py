from typing import Literal

from pydantic import BaseModel

Role = Literal["passenger", "driver", "admin"]
Direction = Literal["inbound", "outbound"]
VehicleType = Literal["van", "bus"]
BookingStatus = Literal["pending", "confirmed", "unmatched", "cancelled", "completed", "no_show"]
TripStatus = Literal["planned", "driver_accepted", "in_progress", "completed", "cancelled"]
DriverStatus = Literal["pending", "approved", "rejected", "suspended"]
BookingType = Literal["scheduled", "repeat", "now"]
TxnType = Literal["topup", "fare_charge", "refund", "driver_payout", "booking_fee_refund"]
TxnStatus = Literal["completed", "pending", "failed"]


class LatLng(BaseModel):
    lat: float
    lng: float


class NamedPoint(BaseModel):
    name: str
    lat: float
    lng: float
