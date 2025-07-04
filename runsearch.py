from selenium import webdriver
import undetected_chromedriver as uc
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from models.mongo_client import get_mongo_client
from models.keyword_model import get_all_keywords
from datetime import datetime
import time
import os

keywords = get_all_keywords()

# create file screenshot
os.makedirs("screenshots", exist_ok=True)

# MongoDB setup
client = get_mongo_client()
db = client["test"]
collection = db.get_collection('ads')

# Setup headless Chrome options
options = uc.ChromeOptions()
custom_user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36"
options.add_argument(f"--user-agent={custom_user_agent}")
options.headless = True
options.add_argument("--no-sandbox")
options.add_argument("--disable-dev-shm-usage")
options.add_argument("--disable-blink-features=AutomationControlled")

driver = uc.Chrome(use_subprocess=False, options=options)

for keyword_doc in keywords:
    keyword = keyword_doc["keyword"]
    print(f"🔍 Đang tìm quảng cáo cho từ khoá: {keyword}")

    try:
        driver.get("https://www.google.com")
        search_box = driver.find_element(By.NAME, "q")
        search_box.clear()
        search_box.send_keys(keyword)
        search_box.send_keys(Keys.RETURN)

        time.sleep(2)  # đợi Google load kết quả

        ad_blocks = driver.find_elements(By.CSS_SELECTOR, "div[data-text-ad]")
        ads_data = []

        for index, ad in enumerate(ad_blocks):
            try:
                text_lines = ad.text.split("\n")
                advertiser = text_lines[1] if len(text_lines) > 1 else ""

                link = ""
                domain = ""

                try:
                    link_el = ad.find_element(By.TAG_NAME, "a")
                    link = link_el.get_attribute("href") or ""
                    if link.startswith("http"):
                        domain = link.split('/')[2]
                except:
                    pass

                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                filename = f"{domain or 'no-domain'}_{index}_{timestamp}.png"
                screenshot_path = os.path.join("screenshots", filename)

                try:
                    ad.screenshot(screenshot_path)
                except:
                    pass

                ad_data = {
                    "keyword": keyword,
                    "link": link,
                    "domain": domain,
                    "advertiser": advertiser,
                    "screenshot_path": screenshot_path,
                    "timestamp": datetime.now()
                }

                ads_data.append(ad_data)

            except:
                pass

        if ads_data:
            collection.insert_many(ads_data)
        else:
            print(f"⚠️ Không tìm thấy quảng cáo nào cho từ khoá '{keyword}'")

    except:
        pass

driver.quit()
