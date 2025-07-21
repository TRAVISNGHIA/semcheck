from fastapi import FastAPI
from api.profile_api import router as profile_router
from api.ads_api import router as ads_router
from api.keyword_api import router as keyword_router

app = FastAPI()
app.include_router(profile_router, prefix="/api/profiles")
app.include_router(ads_router, prefix="/api/ads")

app.include_router(keyword_router, prefix="/api/keywords")
