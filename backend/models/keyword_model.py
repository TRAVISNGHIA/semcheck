from backend.models.mongo_client import get_mongo_client
from bson import ObjectId

client = get_mongo_client()
db = client["test"]
keywords_collection = db["keywords"]

def serialize_keyword(doc):
    return {
        "_id": str(doc["_id"]),
        "keyword": doc.get("keyword", ""),
        "active": doc.get("active", True)  # mặc định True nếu chưa có
    }

def get_all_keywords():
    docs = keywords_collection.find()
    return [serialize_keyword(doc) for doc in docs]
