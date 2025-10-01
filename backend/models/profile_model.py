from backend.models.mongo_client import get_mongo_client
from datetime import datetime

client = get_mongo_client()
db = client["test"]
profiles_collection = db["profiles"]

def save_profile_to_db(profile_name, user_data_dir, profile_directory, user_agent, viewport=None):

    existing = profiles_collection.find_one({"profile_name": profile_name})
    if existing:
        print(f"🔁 Profile '{profile_name}' đã tồn tại.")
        return

    profiles_collection.insert_one({
        "profile_name": profile_name,
        "user_data_dir": user_data_dir,
        "profile_directory": profile_directory,
        "viewport": viewport,
        "created_at": datetime.now()
    })
    print(f"✅ Đã lưu profile '{profile_name}' vào MongoDB.")
def get_profile_by_name(name):
    return profiles_collection.find_one({"name": name})

def get_all_profiles():
    return list(profiles_collection.find())