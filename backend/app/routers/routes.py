from fastapi import APIRouter

from app.models.booking import RouteOptionsRequest, RouteRequestCreate
from app.services.route_options import compute_route_options
from app.storage.repositories import get_repos

router = APIRouter(tags=["routes"])


def _get_settings(repos) -> dict:
    all_settings = repos.settings.all()
    return all_settings[0] if all_settings else {}


@router.post("/routes/options")
def route_options(payload: RouteOptionsRequest):
    repos = get_repos()
    settings = _get_settings(repos)
    options = compute_route_options(
        payload.origin.model_dump(),
        payload.destination.model_dump(),
        repos,
        settings,
        date=payload.date,
        direction_filter=payload.direction,
    )
    return options


@router.post("/route-requests")
def create_route_request(payload: RouteRequestCreate):
    repos = get_repos()
    return repos.route_requests.insert(
        {"origin": payload.origin.model_dump(), "destination": payload.destination.model_dump()}
    )
