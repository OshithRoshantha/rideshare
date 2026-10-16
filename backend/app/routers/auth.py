import time

from fastapi import APIRouter, Depends

from app.core.deps import get_current_user, safe_user
from app.core.errors import bad_request, unauthorized
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import LoginRequest, MeUpdateRequest, RegisterRequest, TokenResponse, UserOut
from app.storage.repositories import get_repos

router = APIRouter(tags=["auth"])

_login_attempts: dict[str, list[float]] = {}


def _rate_limited(email: str) -> bool:
    now = time.time()
    attempts = [t for t in _login_attempts.get(email, []) if now - t < 60]
    _login_attempts[email] = attempts
    return len(attempts) >= 10


@router.post("/auth/register", response_model=TokenResponse)
def register(payload: RegisterRequest):
    repos = get_repos()
    if repos.users.find_one(email=payload.email.lower()):
        raise bad_request("EMAIL_TAKEN", "An account with this email already exists")
    user = repos.users.insert(
        {
            "role": payload.role,
            "full_name": payload.full_name,
            "email": payload.email.lower(),
            "phone": payload.phone,
            "password_hash": hash_password(payload.password),
            "saved_places": [],
            "wallet_balance_lkr": 0,
            "is_active": True,
        }
    )
    if payload.role == "driver":
        repos.drivers.insert(
            {
                "user_id": user["id"],
                "licence_no": "",
                "nic_no": "",
                "status": "pending",
                "rating_avg": 0,
                "rating_count": 0,
                "availability": [],
            }
        )
    token = create_access_token(user["id"], user["role"])
    return TokenResponse(access_token=token, user=UserOut(**safe_user(user)))


@router.post("/auth/login", response_model=TokenResponse)
def login(payload: LoginRequest):
    email = payload.email.lower()
    if _rate_limited(email):
        raise bad_request("RATE_LIMITED", "Too many login attempts. Try again in a minute.")
    _login_attempts.setdefault(email, []).append(time.time())

    repos = get_repos()
    user = repos.users.find_one(email=email)
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise unauthorized(detail="Invalid email or password")
    if not user.get("is_active", True):
        raise unauthorized(detail="Account is inactive")
    token = create_access_token(user["id"], user["role"])
    return TokenResponse(access_token=token, user=UserOut(**safe_user(user)))


@router.get("/me", response_model=UserOut)
def get_me(user: dict = Depends(get_current_user)):
    return UserOut(**safe_user(user))


@router.patch("/me", response_model=UserOut)
def update_me(payload: MeUpdateRequest, user: dict = Depends(get_current_user)):
    repos = get_repos()
    patch = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    if "saved_places" in patch:
        patch["saved_places"] = [p if isinstance(p, dict) else p.model_dump() for p in patch["saved_places"]]
    updated = repos.users.update(user["id"], patch)
    return UserOut(**safe_user(updated))
