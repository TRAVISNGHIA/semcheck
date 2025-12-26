from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from models.mongo_client import get_mongo_client
from passlib.hash import bcrypt
from bson import ObjectId

router = APIRouter()
client = get_mongo_client()
db = client["test"]
users_collection = db["users"]

class RegisterRequest(BaseModel):
    username: str
    password: str

class LoginRequest(BaseModel):
    username: str
    password: str

@router.post("/register")
def register_user(data: RegisterRequest):
    if users_collection.find_one({"username": data.username}):
        raise HTTPException(status_code=409, detail="Username đã tồn tại")

    hashed_password = bcrypt.hash(data.password)
    users_collection.insert_one({
        "username": data.username,
        "password": hashed_password
    })

    return {"message": "Đăng ký thành công"}

@router.post("/login")
def login_user(data: LoginRequest):
    user = users_collection.find_one({"username": data.username})
    if not user or not bcrypt.verify(data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Sai tài khoản hoặc mật khẩu")

    return {"message": "Đăng nhập thành công", "user_id": str(user["_id"])}
