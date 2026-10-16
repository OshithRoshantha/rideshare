import hashlib
import math
import threading
import time

import httpx

from app.config import get_settings
from app.storage.repositories import get_repos

ROAD_FACTOR = 1.3
_throttle_lock = threading.Lock()
_last_nominatim_call = 0.0


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _cache_key(prefix: str, *parts: str) -> str:
    raw = prefix + "|" + "|".join(parts)
    return hashlib.sha256(raw.encode()).hexdigest()


def _throttle():
    global _last_nominatim_call
    with _throttle_lock:
        elapsed = time.time() - _last_nominatim_call
        if elapsed < 1.0:
            time.sleep(1.0 - elapsed)
        _last_nominatim_call = time.time()


def geocode_search(query: str) -> list[dict]:
    repos = get_repos()
    settings = get_settings()
    key = _cache_key("search", query.lower().strip())
    cached = repos.geocode_cache.get(key)
    if cached:
        return cached["result"]

    _throttle()
    try:
        resp = httpx.get(
            f"{settings.nominatim_base_url}/search",
            params={"q": query, "format": "jsonv2", "countrycodes": "lk", "limit": 8},
            headers={"User-Agent": settings.geo_user_agent},
            timeout=10.0,
        )
        resp.raise_for_status()
        data = resp.json()
        result = [
            {
                "name": item.get("name") or item.get("display_name", "").split(",")[0],
                "display_name": item.get("display_name", ""),
                "lat": float(item["lat"]),
                "lng": float(item["lon"]),
            }
            for item in data
        ]
    except (httpx.HTTPError, KeyError, ValueError):
        result = []

    repos.geocode_cache.insert({"id": key, "result": result})
    return result


def reverse_geocode(lat: float, lng: float) -> dict:
    repos = get_repos()
    settings = get_settings()
    key = _cache_key("reverse", f"{lat:.5f}", f"{lng:.5f}")
    cached = repos.geocode_cache.get(key)
    if cached:
        return cached["result"]

    _throttle()
    try:
        resp = httpx.get(
            f"{settings.nominatim_base_url}/reverse",
            params={"lat": lat, "lon": lng, "format": "jsonv2"},
            headers={"User-Agent": settings.geo_user_agent},
            timeout=10.0,
        )
        resp.raise_for_status()
        data = resp.json()
        display_name = data.get("display_name", "")
        result = {"name": display_name.split(",")[0] if display_name else "Dropped pin", "display_name": display_name}
    except (httpx.HTTPError, KeyError, ValueError):
        result = {"name": "Dropped pin", "display_name": ""}

    repos.geocode_cache.insert({"id": key, "result": result})
    return result


def osrm_route(coords: list[tuple[float, float]]) -> dict | None:
    """coords: list of (lat, lng). Returns {polyline:[[lat,lng],...], total_km, total_min, leg_km:[...]}"""
    settings = get_settings()
    coord_str = ";".join(f"{lng},{lat}" for lat, lng in coords)
    try:
        resp = httpx.get(
            f"{settings.osrm_base_url}/route/v1/driving/{coord_str}",
            params={"overview": "full", "geometries": "geojson", "steps": "false"},
            timeout=15.0,
        )
        resp.raise_for_status()
        data = resp.json()
        if data.get("code") != "Ok":
            return None
        route = data["routes"][0]
        polyline = [[c[1], c[0]] for c in route["geometry"]["coordinates"]]
        legs_km = [leg["distance"] / 1000 for leg in route["legs"]]
        return {
            "polyline": polyline,
            "total_km": route["distance"] / 1000,
            "total_min": route["duration"] / 60,
            "legs_km": legs_km,
        }
    except (httpx.HTTPError, KeyError, IndexError, ValueError):
        return None


def fallback_route(coords: list[tuple[float, float]]) -> dict:
    legs_km = []
    for i in range(len(coords) - 1):
        d = haversine_km(*coords[i], *coords[i + 1]) * ROAD_FACTOR
        legs_km.append(d)
    total_km = sum(legs_km)
    total_min = total_km / 20 * 60  # assume 20 km/h average
    polyline = [[lat, lng] for lat, lng in coords]
    return {"polyline": polyline, "total_km": total_km, "total_min": total_min, "legs_km": legs_km}


def snap_to_corridor_stops(lat: float, lng: float, stops: list[dict], max_walk_m: float) -> dict | None:
    """Return the nearest stop within max_walk_m, with walk distance in meters."""
    best = None
    best_dist = float("inf")
    for stop in stops:
        d_km = haversine_km(lat, lng, stop["lat"], stop["lng"])
        d_m = d_km * 1000
        if d_m < best_dist:
            best_dist = d_m
            best = stop
    if best is None or best_dist > max_walk_m:
        return None
    return {"stop": best, "walk_m": round(best_dist)}
