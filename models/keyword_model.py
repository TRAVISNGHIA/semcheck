from models.mongo_client import get_mongo_client

client = get_mongo_client()
db = client["test"]
keywords_collection = db["keywords"]

def get_all_keywords():
    return list(keywords_collection.find())