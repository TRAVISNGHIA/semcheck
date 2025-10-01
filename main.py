import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from backend.api.ads_api import router as ads_router
from backend.api.user_api import router as user_router
from backend.api.profile_api import router as profile_router
from backend.api.keyword_api import router as keyword_router
from backend.api.crawlAds_api import crawl_ads
from backend.api.scheduler_api import router as scheduler_router

load_dotenv()

app = FastAPI()

# CORS config
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
app.include_router(ads_router, prefix="/api/ads", tags=["Ads"])
app.include_router(user_router, prefix="/api/user", tags=["User"])
app.include_router(profile_router, prefix="/api/profiles", tags=["Profiles"])
app.include_router(keyword_router, prefix="/api/keywords", tags=["Keywords"])
app.include_router(scheduler_router, prefix="/api/scheduler", tags=["Scheduler"])

# Endpoint trigger crawl thủ công
@app.post("/api/crawl")
def trigger_crawl():
    crawl_ads()
    return {"message": "Đã crawl xong"}
