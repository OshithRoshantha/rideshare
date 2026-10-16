from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.errors import forbidden, unauthorized
from app.core.security import decode_access_token
from app.storage.repositories import get_repos

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme)) -> dict:
    if credentials is None:
        raise unauthorized(detail="Not authenticated")
    try:
        payload = decode_access_token(credentials.credentials)
    except ValueError as e:
        raise unauthorized(detail=str(e)) from e
    repos = get_repos()
    user = repos.users.get(payload["sub"])
    if user is None or not user.get("is_active", True):
        raise unauthorized(detail="User not found or inactive")
    return user


def require_role(*roles: str):
    def checker(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in roles:
            raise forbidden(detail=f"Requires role: {' or '.join(roles)}")
        return user

    return checker


def safe_user(user: dict) -> dict:
    return {k: v for k, v in user.items() if k != "password_hash"}
