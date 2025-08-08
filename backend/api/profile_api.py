from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from bson import ObjectId
from backend.models.mongo_client import get_mongo_client

router = APIRouter()
client = get_mongo_client()
db = client["test"]
profile_collection = db["profiles"]


class ProfileRequest(BaseModel):
    name: str
    user_data_dir: str
    profile_directory: str
    user_agent: str
    viewport: dict = {}


class UpdateProfileRequest(BaseModel):
    profile_id: str
    updated_data: dict


class DeleteProfileRequest(BaseModel):
    profile_id: str


@router.post("/create")
def create_profile(data: ProfileRequest):
    if profile_collection.find_one({"name": data.name}):
        raise HTTPException(status_code=409, detail="Profile đã tồn tại")

    profile_collection.insert_one(data.dict())
    return {"message": "Đã thêm profile thành công", "name": data.name}


@router.put("/update")
def update_profile(data: UpdateProfileRequest):
    try:
        profile_id = data.profile_id
        new_data = data.updated_data

        if "name" in new_data:
            # check duplicate name
            existing = profile_collection.find_one({"name": new_data["name"]})
            if existing and str(existing["_id"]) != profile_id:
                raise HTTPException(status_code=409, detail="Tên profile đã tồn tại")

        result = profile_collection.update_one(
            {"_id": ObjectId(profile_id)},
            {"$set": new_data}
        )

        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Không tìm thấy hoặc không có gì thay đổi")

        return {"message": "Cập nhật profile thành công"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/delete")
def delete_profile(profile_id: str = Query(...)):
    try:
        result = profile_collection.delete_one({"_id": ObjectId(profile_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Không tìm thấy profile")
        return {"message": "Xoá profile thành công"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))