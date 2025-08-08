from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from bson import ObjectId
from backend.models.mongo_client import get_mongo_client

router = APIRouter()
client = get_mongo_client()
db = client["test"]
keyword_collection = db["keywords"]

class KeywordRequest(BaseModel):
    keyword: str

class UpdateKeywordRequest(BaseModel):
    keyword_id: str
    new_keyword: str

class DeleteKeywordRequest(BaseModel):
    keyword_id: str

@router.post("/create")
def create_keyword(data: KeywordRequest):
    keyword = data.keyword.strip()
    if not keyword:
        raise HTTPException(status_code=400, detail="Keyword không được để trống")

    if keyword_collection.find_one({"keyword": keyword}):
        raise HTTPException(status_code=409, detail="Keyword đã tồn tại")

    keyword_collection.insert_one({"keyword": keyword})
    return {"message": "Thêm từ khoá thành công", "keyword": keyword}


@router.put("/update")
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

    return {"message": "Đã cập nhật từ khoá thành công", "new_keyword": new_keyword}


@router.post("/delete")
def delete_keyword(data: DeleteKeywordRequest):
    keyword_id = data.keyword_id

    result = keyword_collection.delete_one({"_id": ObjectId(keyword_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Không tìm thấy từ khoá")

    return {"message": "Đã xoá từ khoá thành công"}

