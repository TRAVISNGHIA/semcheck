# Import các thư viện cần thiết
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from datetime import datetime
from urllib.parse import urlparse
import os
import shutil
import random
import boto3
from botocore.client import Config
from dotenv import load_dotenv
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# Import các hàm thao tác DB
from backend.models.keyword_model import get_all_keywords
from backend.models.mongo_client import get_mongo_client
from backend.models.profile_model import get_all_profiles

router = APIRouter()

# Load biến môi trường từ file .env
load_dotenv()
R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY")
R2_BUCKET_NAME = os.getenv("R2_BUCKET_NAME")
R2_ENDPOINT_URL = os.getenv("R2_ENDPOINT_URL")
BASE_PROFILE_PATH = os.getenv("BASE_PROFILE_PATH")
WORKING_PROFILE_PATH = os.getenv("WORKING_PROFILE_PATH")

# Hàm upload ảnh lên Cloudflare R2
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
        return True
    except Exception as e:
        print(f"Upload thất bại: {e}")
        return False

# Chọn random 1 profiles hợp lệ (có thư mục + user_agent)
def choose_valid_random_profile():
    profiles = get_all_profiles()
    valid_profiles = []
    for p in profiles:
        name = p.get("name", "").strip()
        path = f"/home/nghia/.config/google-chrome/{name}"
        if os.path.exists(path) and "user_agent" in p:
            valid_profiles.append(p)
    return random.choice(valid_profiles) if valid_profiles else None

# Endpoint chính để crawl quảng cáo
@router.post("/api/crawl")
def crawl_ads():
    # Lấy toàn bộ keyword cần crawl
    keywords = get_all_keywords()
    if not keywords:
        return JSONResponse(content={"error": "Không có keyword nào"}, status_code=400)

    # Chọn 1 profiles để crawl
    profile = choose_valid_random_profile()
    if not profile:
        return JSONResponse(content={"error": "Không tìm được profiles hợp lệ"}, status_code=400)

    profile_name = profile["name"].strip()
    print(f"Đang dùng profiles: {profile_name}")

    # Clone profiles gốc sang thư mục mới để tránh xung đột khi chạy UC browser
    base_profile_path = f"{BASE_PROFILE_PATH}/{profile_name}"
    clone_folder = f"{profile_name.replace(' ', '_')}_clone_"
    working_profile_path = f"{WORKING_PROFILE_PATH}/{clone_folder}"

    # Bỏ qua file Singleton để tránh lỗi khi copy profiles
    def ignore_singleton_files(_, files):
        return [f for f in files if f.startswith("Singleton")]

    # Nếu profiles clone chưa tồn tại thì clone
    if not os.path.exists(working_profile_path):
        try:
            shutil.copytree(base_profile_path, working_profile_path, ignore=ignore_singleton_files)
        except Exception as e:
            return JSONResponse(content={"error": f"Lỗi clone profiles: {e}"}, status_code=500)

    # Cập nhật lại thông tin thư mục profiles clone
    profile["user_data_dir"] = "/home/nghia/.config/google-chrome-uc/"
    profile["profile_directory"] = clone_folder

    # Reset lại folder lưu ảnh screenshot
    if os.path.exists("screenshots"):
        shutil.rmtree("screenshots")
    os.makedirs("screenshots", exist_ok=True)

    # Kết nối tới MongoDB
    client = get_mongo_client()
    db = client["test"]
    collection = db.get_collection("ads")

    # Config UC Chrome
    options = uc.ChromeOptions()
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument(f"--user-data-dir={profile['user_data_dir']}")
    options.add_argument(f"--profiles-directory={profile['profile_directory']}")
    options.add_argument(f"--user-agent={profile['user_agent']}")

    # Mở trình duyệt
    driver = uc.Chrome(version_main=138, options=options)
    total_ads = 0
    all_uploaded = True  # Kiểm tra upload ảnh có lỗi không

    # Duyệt từng keyword để crawl
    for keyword_doc in keywords:
        keyword = keyword_doc["keyword"]
        try:
            # Tìm kiếm keyword trên Google
            driver.get(f"https://www.google.com/search?q={keyword}")
            WebDriverWait(driver, 15).until(
                EC.presence_of_element_located((By.XPATH, "//*[contains(text(),'Quảng cáo')]"))
            )

            # Lấy các block quảng cáo
            ad_blocks = driver.find_elements(By.XPATH, "//*[contains(text(),'Quảng cáo')]/ancestor::div[contains(@data-text-ad,'')]")
            if not ad_blocks:
                continue

            ads_data = []

            # Lặp từng block quảng cáo
            for ad in ad_blocks:

                link, domain, advertiser = None, None, None

                # Tìm link quảng cáo
                for link_element in ad.find_elements(By.XPATH, ".//a[@href]"):
                    href = link_element.get_attribute("href")
                    if href and href.startswith("http"):
                        link = href
                        domain = urlparse(link).netloc
                        break

                if not link:
                    continue
                try:
                    advertiser_element = ad.find_element(By.XPATH, ".//span[contains(text(),'.') or contains(text(),'www')]")
                    advertiser = advertiser_element.text.strip()
                except:
                    advertiser = ""

                if not advertiser and domain:
                    advertiser = domain

                # Chụp ảnh quảng cáo
                screenshot_filename = f"{datetime.now().timestamp()}.png"
                screenshot_path = os.path.join("screenshots", screenshot_filename)
                ad.screenshot(screenshot_path)

                # Upload ảnh lên Cloudflare R2
                uploaded = upload_to_r2(screenshot_path, f"screenshots/{screenshot_filename}")
                if not uploaded:
                    all_uploaded = False

                # Lưu thông tin quảng cáo
                ads_data.append({
                    "profile_name": profile_name,
                    "keyword": keyword,
                    "link": link,
                    "domain": domain,
                    "advertiser": advertiser,
                    "screenshot_path": f"screenshots/{screenshot_filename}" if uploaded else screenshot_path,
                    "timestamp": datetime.now()
                })

            # Lưu vào Mongo nếu có data
            if ads_data:
                collection.insert_many(ads_data)
                total_ads += len(ads_data)

        except Exception as e:
            print(f"Lỗi khi xử lý '{keyword}': {e}")
            continue

    # Đóng trình duyệt
    driver.quit()

    # Nếu upload thành công hết thì xóa folder screenshots
    if all_uploaded and os.path.exists("screenshots"):
        shutil.rmtree("screenshots")

    return {"status": "done", "ads_collected": total_ads}
