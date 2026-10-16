from fastapi import APIRouter, Depends

from app.core.deps import get_current_user
from app.models.misc import TopupRequest
from app.storage.repositories import get_repos

router = APIRouter(prefix="/wallet", tags=["wallet"])


@router.get("")
def get_wallet(user: dict = Depends(get_current_user)):
    repos = get_repos()
    fresh = repos.users.get(user["id"])
    txns = sorted(repos.transactions.find(user_id=user["id"]), key=lambda t: t["created_at"], reverse=True)
    return {"balance": fresh["wallet_balance_lkr"], "transactions": txns}


@router.post("/topup")
def topup(payload: TopupRequest, user: dict = Depends(get_current_user)):
    repos = get_repos()
    fresh = repos.users.get(user["id"])
    new_balance = fresh["wallet_balance_lkr"] + payload.amount_lkr
    repos.users.update(user["id"], {"wallet_balance_lkr": new_balance})
    txn = repos.transactions.insert(
        {
            "user_id": user["id"],
            "type": "topup",
            "amount_lkr": payload.amount_lkr,
            "booking_id": None,
            "trip_id": None,
            "status": "completed",
            "note": "Wallet top-up",
        }
    )
    return {"balance": new_balance, "transaction": txn}
