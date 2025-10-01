from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from bson import ObjectId
import os

from backend.models.mongo_client import get_mongo_client

router = APIRouter()
client = get_mongo_client()
db = client["test"]
ads_collection = db["ads"]

class DeleteAdRequest(BaseModel):
    ad_id: str

@router.get("/")
def get_all_ads():
    ads = list(ads_collection.find())
    result = []
    for ad in ads:
        result.append({
            "id": str(ad.get("_id")),
            "profile_name": ad.get("profile_name"),
            "keyword": ad.get("keyword", ""),
            "advertiser": ad.get("advertiser", ""),
            "link": ad.get("link", ""),
            "domain": ad.get("domain", ""),
            "screenshot_path": ad.get("screenshot_path", ""),
            "timestamp": ad.get("timestamp", ""),
        })
    return result

@router.delete("/delete")
def delete_ad(data: DeleteAdRequest):
    ad = ads_collection.find_one({"_id": ObjectId(data.ad_id)})
    if not ad:
        raise HTTPException(status_code=404, detail="Không tìm thấy quảng cáo")

    screenshot_path = ad.get("screenshot_path")
    if screenshot_path and os.path.exists(screenshot_path):
        os.remove(screenshot_path)
        print(f"Đã xoá ảnh: {screenshot_path}")

    ads_collection.delete_one({"_id": ObjectId(data.ad_id)})
    return {"message": "Đã xoá quảng cáo và ảnh thành công!"}
