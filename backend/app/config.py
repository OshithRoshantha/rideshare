from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "RideShare Route"
    jwt_secret: str = "change-this-dev-secret-please"
    jwt_algorithm: str = "HS256"
    jwt_expire_days: int = 7
    timezone: str = "Asia/Colombo"
    data_dir: str = "./data"
    nominatim_base_url: str = "https://nominatim.openstreetmap.org"
    osrm_base_url: str = "https://router.project-osrm.org"
    geo_user_agent: str = "RideShareRoute-MVP/0.1 (contact@example.com)"
    cors_origins: str = "http://localhost:5173"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
