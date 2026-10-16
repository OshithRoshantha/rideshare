from fastapi import APIRouter, Query

from app.services.geo import geocode_search, reverse_geocode

router = APIRouter(prefix="/geo", tags=["geo"])


@router.get("/search")
def search(q: str = Query(min_length=3)):
    return geocode_search(q)


@router.get("/reverse")
def reverse(lat: float, lng: float):
    return reverse_geocode(lat, lng)
