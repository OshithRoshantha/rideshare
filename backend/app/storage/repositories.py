from functools import lru_cache

from app.config import get_settings
from app.storage.json_store import JsonStore


class Repositories:
    def __init__(self, data_dir: str):
        self.users = JsonStore(data_dir, "users")
        self.drivers = JsonStore(data_dir, "drivers")
        self.vehicles = JsonStore(data_dir, "vehicles")
        self.corridors = JsonStore(data_dir, "corridors")
        self.stops = JsonStore(data_dir, "stops")
        self.time_slots = JsonStore(data_dir, "time_slots")
        self.bookings = JsonStore(data_dir, "bookings")
        self.trips = JsonStore(data_dir, "trips")
        self.transactions = JsonStore(data_dir, "transactions")
        self.notifications = JsonStore(data_dir, "notifications")
        self.ratings = JsonStore(data_dir, "ratings")
        self.route_requests = JsonStore(data_dir, "route_requests")
        self.settings = JsonStore(data_dir, "settings")
        self.geocode_cache = JsonStore(data_dir, "geocode_cache")


@lru_cache
def get_repos() -> Repositories:
    settings = get_settings()
    return Repositories(settings.data_dir)
