from contextlib import asynccontextmanager

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.core.time_utils import now
from app.routers import admin, auth, bookings, corridors, driver, geo, notifications, routes, wallet
from app.services.matching import run_matching

scheduler = BackgroundScheduler(timezone=get_settings().timezone)


def _nightly_matching_job():
    target_date = (now() + __import__("datetime").timedelta(days=1)).strftime("%Y-%m-%d")
    run_matching(target_date)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    cutoff_hh, cutoff_mm = 21, 0
    scheduler.add_job(
        _nightly_matching_job,
        CronTrigger(hour=cutoff_hh, minute=cutoff_mm, timezone=settings.timezone),
        id="nightly_matching",
        replace_existing=True,
    )
    scheduler.start()
    yield
    scheduler.shutdown(wait=False)


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name, lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(auth.router, prefix="/api")
    app.include_router(geo.router, prefix="/api")
    app.include_router(corridors.router, prefix="/api")
    app.include_router(routes.router, prefix="/api")
    app.include_router(bookings.router, prefix="/api")
    app.include_router(wallet.router, prefix="/api")
    app.include_router(driver.router, prefix="/api")
    app.include_router(admin.router, prefix="/api")
    app.include_router(notifications.router, prefix="/api")

    @app.get("/api/health")
    def health():
        return {"status": "ok", "app": settings.app_name}

    return app


app = create_app()
