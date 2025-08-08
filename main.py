import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from bson import ObjectId
from backend.models.mongo_client import get_mongo_client
from backend.api.ads_api import router as ads_router
from dotenv import load_dotenv
from backend.api.user_api import router as user_router

load_dotenv()

app = FastAPI()

# CORS cho phép gọi từ frontend (Next.js)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = get_mongo_client()
db = client["test"]
keyword_collection = db["keywords"]

class KeywordRequest(BaseModel):
    keyword: str

class UpdateKeywordRequest(BaseModel):
    keyword_id: str
    new_keyword: str

@app.get("/api/keywords")
def get_keywords():
    keywords = list(keyword_collection.find())
    return [{"_id": str(kw["_id"]), "keyword": kw["keyword"]} for kw in keywords]

@app.post("/api/keywords")
def create_keyword(data: KeywordRequest):
    keyword = data.keyword.strip()
    if not keyword:
        raise HTTPException(status_code=400, detail="Keyword không được để trống")

    if keyword_collection.find_one({"keyword": keyword}):
        raise HTTPException(status_code=409, detail="Keyword đã tồn tại")

    result = keyword_collection.insert_one({"keyword": keyword})
    return {"message": "Thêm thành công", "id": str(result.inserted_id)}

@app.delete("/api/keywords/{keyword_id}")
def delete_keyword(keyword_id: str):
    result = keyword_collection.delete_one({"_id": ObjectId(keyword_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Không tìm thấy từ khoá")
    return {"message": "Xoá thành công"}

@app.put("/api/keywords")
def update_keyword(data: UpdateKeywordRequest):
    keyword_id = data.keyword_id
    new_keyword = data.new_keyword.strip()

    if not new_keyword:
        raise HTTPException(status_code=400, detail="Từ khoá mới không được để trống")

    if keyword_collection.find_one({"keyword": new_keyword}):
        raise HTTPException(status_code=409, detail="Từ khoá mới đã tồn tại")

    result = keyword_collection.update_one(
        {"_id": ObjectId(keyword_id)},
        {"$set": {"keyword": new_keyword}}
    )

    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Không tìm thấy từ khoá hoặc không có gì thay đổi")

    return {"message": "Đã cập nhật thành công"}

@app.post("/api/crawl")
def trigger_crawl():
    from backend.api.crawlAds_api import crawl_ads
    crawl_ads()
    return {"message": "Đã crawl xong"}

app.include_router(ads_router, prefix="/api")
app.include_router(user_router, prefix="/api/user")
