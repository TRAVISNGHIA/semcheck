import os
import shutil
from datetime import datetime
from urllib.parse import urlparse

from selenium.webdriver.common.by import By
import undetected_chromedriver as uc
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC


from models.keyword_model import get_all_keywords
from models.mongo_client import get_mongo_client
from models.profile_model import get_all_profiles

import boto3
from botocore.client import Config
from dotenv import load_dotenv

# ==== Load biến môi trường từ .env để kết nối Cloudflare R2 ====
load_dotenv()
R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY")
R2_BUCKET_NAME = os.getenv("R2_BUCKET_NAME")
R2_ENDPOINT_URL = os.getenv("R2_ENDPOINT_URL")

# ==== Hàm upload ảnh chụp lên R2 ====
def upload_to_r2(local_path, remote_path):
    session = boto3.Session()
    s3 = session.client(
        service_name='s3',
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        endpoint_url=R2_ENDPOINT_URL,
        config=Config(signature_version='s3v4', s3={'addressing_style': 'path'}),
        region_name='auto'
    )
    try:
        s3.upload_file(local_path, R2_BUCKET_NAME, remote_path)
        # os.remove(local_path)
        return True
    except Exception as e:
        print(f"❌ Upload thất bại: {e}")
        return False

# ==== Lấy danh sách keyword và profile từ MongoDB ====
keywords = get_all_keywords()
if not keywords:
    exit(1)

profiles = get_all_profiles()
if not profiles:
    exit(1)

# ==== Cho user chọn profile ====
print("🧠 Chọn profile muốn dùng:")
for i, p in enumerate(profiles):
    print(f"{i + 1}. {p['name']}")
try:
    selected_index = int(input("Nhập số: ")) - 1
    profile = profiles[selected_index]
except (ValueError, IndexError):
    print("Không có profile này.")
    exit(1)

# ==== Clone profile nếu chưa tồn tại ====
profile_name = profile["name"].strip()
base_profile_path = f"/home/nghia/.config/google-chrome/{profile_name}"
clone_folder = f"{profile_name.replace(' ', '_')}_clone_"
working_profile_path = f"/home/nghia/.config/google-chrome-uc/{clone_folder}"

def ignore_singleton_files(dir, files):
    return [f for f in files if f.startswith("Singleton")]

if not os.path.exists(working_profile_path):
    try:
        shutil.copytree(base_profile_path, working_profile_path, ignore=ignore_singleton_files)
    except Exception as e:
        exit(1)
else:
    print(f"use profile: {working_profile_path}")

# Gán thông tin user data directory vào profile
profile["user_data_dir"] = "/home/nghia/.config/google-chrome-uc/"
profile["profile_directory"] = clone_folder

# ==== Tạo folder lưu ảnh chụp ====
os.makedirs("screenshots", exist_ok=True)

# ==== Setup MongoDB ====
client = get_mongo_client()
db = client["test"]
collection = db.get_collection("ads")

# ==== Khởi tạo trình duyệt Chrome với profile đã clone ====
options = uc.ChromeOptions()
options.add_argument("--no-sandbox")
options.add_argument("--disable-dev-shm-usage")
# options.add_argument("--headless=new")
options.add_argument("--disable-blink-features=AutomationControlled")
options.add_argument(f"--user-data-dir={profile['user_data_dir']}")
options.add_argument(f"--profile-directory={profile['profile_directory']}")
options.add_argument(f"--user-agent={profile['user_agent']}")

driver = uc.Chrome(options=options)

# ==== Lặp từng từ khoá để tìm kiếm và lưu quảng cáo ====
for keyword_doc in keywords:
    keyword = keyword_doc["keyword"]
    try:
        driver.get(f"https://www.google.com/search?q={keyword}")
        WebDriverWait(driver, 15).until(
            EC.presence_of_element_located((By.XPATH, "//*[contains(text(),'Quảng cáo')]"))
        )

        # Lấy các khối quảng cáo có nhãn "Quảng cáo"
        ad_blocks = driver.find_elements(By.XPATH, "//*[contains(text(),'Quảng cáo')]/ancestor::div[contains(@data-text-ad,'')]")
        if not ad_blocks:
            print(f"⚠️ Không thấy quảng cáo cho: {keyword}")
            continue

        ads_data = []
        for ad in ad_blocks:
            ad_text = ad.text
            text_lines = ad_text.split("\n")
            advertiser = text_lines[1] if len(text_lines) > 1 else ""

            link, domain = None, None
            for link_element in ad.find_elements(By.XPATH, ".//a[@href]"):
                href = link_element.get_attribute("href")
                if href and href.startswith("http"):
                    link = href
                    domain = urlparse(link).netloc
                    break

            if not link:
                continue

            # Chụp ảnh quảng cáo
            screenshot_filename = f"{datetime.now().timestamp()}.png"
            screenshot_path = os.path.join("screenshots", screenshot_filename)
            ad.screenshot(screenshot_path)
            uploaded = upload_to_r2(screenshot_path, f"screenshots/{screenshot_filename}")

            # Lưu dữ liệu quảng cáo
            ads_data.append({
                "keyword": keyword,
                "link": link,
                "domain": domain,
                "advertiser": advertiser,
                "screenshot_path": f"screenshots/{screenshot_filename}" if uploaded else screenshot_path,
                "timestamp": datetime.now()
            })

        # Ghi vào Mongo nếu có dữ liệu
        if ads_data:
            collection.insert_many(ads_data)

    except Exception as e:
        print(f"❌ Lỗi khi xử lý '{keyword}': {e}")

driver.quit()
