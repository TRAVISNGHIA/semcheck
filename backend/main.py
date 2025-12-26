import os
import redis
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# routers
from api.ads_api import router as ads_router
from api.user_api import router as user_router
from api.profile_api import router as profile_router
from api.keyword_api import router as keyword_router
from api.crawlAds_api import router as crawl_router

load_dotenv()

REDIS_URL = os.getenv("REDIS_URL")

app = FastAPI(title="My Crawler API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup():
    try:
        app.state.redis = redis.from_url(REDIS_URL, decode_responses=True)
        app.state.redis.ping()
        print("[startup] redis connected")
    except Exception as e:
        print("[startup] redis connect failed:", e)

@app.on_event("shutdown")
def shutdown():
    try:
        client = getattr(app.state, "redis", None)
        if client:
            client.close()
            print("[shutdown] redis closed")
    except Exception as e:
        print("[shutdown] redis close error:", e)

# mount routers
app.include_router(ads_router, prefix="/api/ads", tags=["Ads"])
app.include_router(user_router, prefix="/api/user", tags=["User"])
app.include_router(profile_router, prefix="/api/profiles", tags=["Profiles"])
app.include_router(keyword_router, prefix="/api/keywords", tags=["Keywords"])

app.include_router(crawl_router)

@app.get("/")
def root():
    return {"ok": True, "msg": "API running"}
