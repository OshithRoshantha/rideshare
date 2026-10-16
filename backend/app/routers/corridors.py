from fastapi import APIRouter

from app.storage.repositories import get_repos

router = APIRouter(prefix="/corridors", tags=["corridors"])


def assemble_corridor(corridor: dict, repos) -> dict:
    stops = sorted(repos.stops.find(corridor_id=corridor["id"]), key=lambda s: s["order"])
    slots = repos.time_slots.find(corridor_id=corridor["id"])
    return {**corridor, "stops": stops, "slots": slots}


@router.get("")
def list_corridors():
    repos = get_repos()
    return [assemble_corridor(c, repos) for c in repos.corridors.all() if c.get("is_active", True)]


@router.get("/{corridor_id}")
def get_corridor(corridor_id: str):
    repos = get_repos()
    corridor = repos.corridors.get(corridor_id)
    if not corridor:
        from app.core.errors import not_found

        raise not_found(detail="Corridor not found")
    return assemble_corridor(corridor, repos)
