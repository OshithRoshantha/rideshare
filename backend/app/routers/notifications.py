from fastapi import APIRouter, Depends

from app.core.deps import get_current_user
from app.core.errors import not_found
from app.storage.repositories import get_repos

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
def list_notifications(user: dict = Depends(get_current_user)):
    repos = get_repos()
    items = sorted(repos.notifications.find(user_id=user["id"]), key=lambda n: n["created_at"], reverse=True)
    return items


@router.post("/{notification_id}/read")
def mark_read(notification_id: str, user: dict = Depends(get_current_user)):
    repos = get_repos()
    n = repos.notifications.get(notification_id)
    if not n or n["user_id"] != user["id"]:
        raise not_found(detail="Notification not found")
    return repos.notifications.update(notification_id, {"read": True})


@router.post("/read-all")
def mark_all_read(user: dict = Depends(get_current_user)):
    repos = get_repos()
    items = repos.notifications.find(user_id=user["id"])
    for n in items:
        if not n["read"]:
            repos.notifications.update(n["id"], {"read": True})
    return {"updated": len(items)}
