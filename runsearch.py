import os
import time
from datetime import datetime
from urllib.parse import urlparse

import undetected_chromedriver as uc
from selenium.webdriver.common.by import By

from models.keyword_model import get_all_keywords
from models.mongo_client import get_mongo_client
from models.profile_model import get_profile_by_name, get_all_profiles

keywords = get_all_keywords()
profile = get_profile_by_name("Default")
profiles = get_all_profiles()

if not profile:
    print(f"No profiles found")

# create file screenshot
os.makedirs("screenshots", exist_ok=True)

# MongoDB setup
client = get_mongo_client()
db = client["test"]
collection = db.get_collection('ads')

# Setup Chrome options
options = uc.ChromeOptions()
# user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36"
options.add_argument(f"--user-data-dir={profile['user_data_dir']}")
options.add_argument(f"--profile-directory={profile['profile_directory']}")
options.add_argument(f"--user-agent={profile['user_agent']}")
# options.headless = True
options.add_argument("--no-sandbox")
options.add_argument("--disable-dev-shm-usage")
options.add_argument("--disable-blink-features=AutomationControlled")

driver = uc.Chrome(use_subprocess=False, options=options)
viewport = profile.get("viewport")
if viewport:
    driver.execute_cdp_cmd("Emulation.setDeviceMetricsOverride", viewport)

# keyword search loop
for keyword_doc in keywords:
    keyword = keyword_doc["keyword"]

    try:
        driver.get(f"https://www.google.com/search?q={keyword}")

        time.sleep(2)
        ad_blocks = driver.find_elements(By.CSS_SELECTOR, "div[data-text-ad]")

        if not ad_blocks:
            print(f"⚠️ Không tìm thấy quảng cáo nào cho từ khoá '{keyword}'")
            continue

        ads_data = []
        for index, ad in enumerate(ad_blocks):
                # Tim truc tiep element can lay
                text_lines = ad.text.split("\n")
                advertiser = text_lines[1] if len(text_lines) > 1 else ""

                link_element = ad.find_element(By.TAG_NAME, "a")

                link = link_element.get_attribute("href") or ""
                domain = urlparse(link).netloc

                screenshot_path = f"screenshots/{domain or 'no-domain'}_{index}_{datetime.now().timestamp}.png"
                ad.screenshot(screenshot_path)
                ad_data = {
                    "keyword": keyword,
                    "link": link,
                    "domain": domain,
                    "advertiser": advertiser,
                    "screenshot_path": screenshot_path,
                    "timestamp": datetime.now()
                }
                ads_data.append(ad_data)

        if ads_data:
            collection.insert_many(ads_data)

    except Exception as e:
        print(f"⚠️ Lỗi tìm kiếm'")
driver.quit()
