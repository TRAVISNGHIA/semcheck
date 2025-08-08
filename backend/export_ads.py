import pandas as pd
from backend.models.mongo_client import get_mongo_client

# Kết nối MongoDB
client = get_mongo_client()
db = client["test"]
collection = db.get_collection('ads')

ads = list(collection.find({}, {'_id': 0}))

if not ads:
    print("⚠️ Không có dữ liệu quảng cáo để xuất.")
    exit()

# Export file Excel
df = pd.DataFrame(ads)
excel_path = "SEM_ads.xlsx"
df.to_excel(excel_path, index=False)
print(f"Export data to Excel file successfully: {excel_path}")