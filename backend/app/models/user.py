from pydantic import BaseModel, EmailStr, Field

from app.models.common import NamedPoint, Role


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    phone: str = Field(min_length=7, max_length=15)
    password: str = Field(min_length=6, max_length=100)
    role: Role = "passenger"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class SavedPlace(BaseModel):
    label: str
    name: str
    lat: float
    lng: float


class UserOut(BaseModel):
    id: str
    role: Role
    full_name: str
    email: str
    phone: str
    saved_places: list[SavedPlace] = []
    wallet_balance_lkr: float = 0
    is_active: bool = True


class MeUpdateRequest(BaseModel):
    full_name: str | None = None
    phone: str | None = None
    saved_places: list[SavedPlace] | None = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
