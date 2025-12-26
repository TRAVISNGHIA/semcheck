from mongo_client import get_mongo_client

client = get_mongo_client()
db = client["test"]
ads_collection = db["ads"]

def get_all_keywords():
    return list(ads_collection.find())