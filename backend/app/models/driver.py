from pydantic import BaseModel, Field

from app.models.common import Direction, DriverStatus, VehicleType


class VehicleIn(BaseModel):
    type: VehicleType
    seats: int = Field(gt=0, le=60)
    plate_no: str
    model: str
    colour: str
    has_ac: bool = True


class OnboardingRequest(BaseModel):
    licence_no: str
    nic_no: str
    vehicle: VehicleIn


class AvailabilityItem(BaseModel):
    corridor_id: str
    direction: Direction
    slot_ids: list[str]
    weekdays: list[int] = Field(default_factory=lambda: [1, 2, 3, 4, 5])


class AvailabilityUpdate(BaseModel):
    availability: list[AvailabilityItem]


class DriverOut(BaseModel):
    id: str
    user_id: str
    full_name: str | None = None
    licence_no: str
    nic_no: str
    status: DriverStatus
    rating_avg: float = 0
    rating_count: int = 0
    availability: list[AvailabilityItem] = []
    vehicle: VehicleIn | None = None
