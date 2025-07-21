# api/ads_api.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from bson import ObjectId
import os

from models.mongo_client import get_mongo_client

router = APIRouter()
client = get_mongo_client()
db = client["test"]
ads_collection = db["ads"]
@router.get("/all")
def get_all_ads():
    ads = list(ads_collection.find())
    for ad in ads:
        ad["_id"] = str(ad["_id"])  # chuyển ObjectId thành string cho dễ xài
    return ads

class DeleteAdRequest(BaseModel):
    ad_id: str

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
