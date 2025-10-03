import os
import time
import random
import shutil
import requests
import boto3
from datetime import datetime
from urllib.parse import urlparse, parse_qs

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from botocore.client import Config

import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

from backend.models.keyword_model import get_all_keywords
from backend.models.mongo_client import get_mongo_client
from backend.models.profile_model import get_all_profiles

router = APIRouter()
load_dotenv()

R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY")
R2_BUCKET_NAME = os.getenv("R2_BUCKET_NAME")
R2_ENDPOINT_URL = os.getenv("R2_ENDPOINT_URL")
PATH_PROFILE = os.getenv("PATH_PROFILE")
PATH_PROFILE_CLONE = os.getenv("PATH_PROFILE_CLONE")
API_PROXY_URL = os.getenv("API_PROXY_URL")

UA_MOBILE_FILE = os.getenv("USER_AGENT_MOBILE_FILE")
UA_TABLET_FILE = os.getenv("USER_AGENT_TABLET_FILE")
UA_LAPTOP_FILE = os.getenv("USER_AGENT_LAPTOP_FILE")

def load_uas(path: str) -> list[str]:
    if not path or not os.path.exists(path):
        return []
    with open(path, "r", encoding="utf-8") as f:
        return [line.strip() for line in f if line.strip()]

uas_mobile = load_uas(UA_MOBILE_FILE)
uas_tablet = load_uas(UA_TABLET_FILE)
uas_laptop = load_uas(UA_LAPTOP_FILE)


def choose_user_agent_and_window(profile: dict, keyword: str = None):
    if profile.get("user_agent"):
        user_agent = profile["user_agent"]
        if any(x in user_agent for x in ["Mobile", "iPhone", "Android"]):
            return user_agent, (390, 844)
        if any(x in user_agent for x in ["iPad", "Tablet", "SM-T", "Tab", "Nexus 7"]):
            return user_agent, (820, 1180)
        return user_agent, (1366, 768)

    device = (profile.get("device_type") or "").lower().strip()
    if not device and keyword:
        k = keyword.lower()
        if any(w in k for w in ["app", "ứng dụng", "mobile", "iphone", "android"]):
            device = "mobile"
        elif any(w in k for w in ["ipad", "tablet", "tab"]):
            device = "tablet"
        else:
            device = "laptop"

    if device == "mobile":
        user_agent = random.choice(uas_mobile) if uas_mobile else ""
        window = (390, 844)
    elif device == "tablet":
        user_agent = random.choice(uas_tablet) if uas_tablet else ""
        window = (820, 1180)
    else:
        user_agent = random.choice(uas_laptop) if uas_laptop else ""
        window = (1366, 768)

    if not user_agent:
        user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
    return user_agent, window


def upload_to_r2(local_path: str, remote_path: str) -> bool:
    s3 = boto3.client(
        "s3",
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        endpoint_url=R2_ENDPOINT_URL,
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
        region_name="auto",
    )
    try:
        s3.upload_file(local_path, R2_BUCKET_NAME, remote_path)
        return True
    except Exception as e:
        print(f"[Upload Error] {e}")
        return False


profile_index = 0
def choose_next_profile():
    global profile_index
    profiles = get_all_profiles()
    valid_profiles = [
        p for p in profiles
        if os.path.exists(f"{PATH_PROFILE}/{p.get('name','').strip()}")
    ]
    if not valid_profiles:
        return None
    profile = valid_profiles[profile_index % len(valid_profiles)]
    profile_index += 1
    return profile


def get_proxy_from_api():
    url = API_PROXY_URL
    try:
        resp = requests.get(url, timeout=10)
        text = resp.text.strip()
        if ":" in text and len(text.split(":")) == 4:
            return tuple(text.split(":"))
        data = resp.json()
        proxy_str = data.get("proxyhttp")
        if proxy_str and len(proxy_str.split(":")) == 4:
            return tuple(proxy_str.split(":"))
        return (data.get("ip"), data.get("port"), data.get("username"), data.get("password"))
    except Exception as e:
        print(f"[Proxy Error] {e}")
        return None, None, None, None

def extract_real_link_and_domain(href: str):
    if "google.com/aclk" in href or "google.com/url" in href:
        qs = parse_qs(urlparse(href).query)
        real_url = qs.get("adurl", qs.get("q", [href]))[0]
        return real_url, urlparse(real_url).netloc.replace("www.", "")
    return href, urlparse(href).netloc.replace("www.", "")

def scroll_and_focus(driver, element, timeout=5) -> bool:
    driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", element)
    time.sleep(random.uniform(0.4, 1.0))

    ActionChains(driver).move_to_element(element).pause(random.uniform(0.15, 0.6)).perform()

    end = time.time() + timeout
    while time.time() < end:
        if element.is_displayed() and element.size.get("height", 0) > 8:
            return True
        time.sleep(0.2)
    return False

# ROUTER
@router.post("/")
def crawl_ads():
    keywords = get_all_keywords()
    if not keywords:
        return JSONResponse({"error": "Không có keyword nào"}, status_code=400)

    profile = choose_next_profile()
    if not profile:
        return JSONResponse({"error": "Không tìm được profiles hợp lệ"}, status_code=400)

    def clone_chrome_profile(src: str, dst: str):
        if not os.path.exists(dst):
            shutil.copytree(
                src, dst,
                ignore=lambda _, files: [f for f in files if f.startswith("Singleton")]
            )
        else:
            for sf in ["SingletonCookie", "SingletonLock", "SingletonSocket"]:
                path = os.path.join(dst, sf)
                if os.path.exists(path):
                    os.remove(path)

    profile_name = profile["name"].strip()
    print(f"Đang dùng profile: {profile_name}")

    profile_path = f"{PATH_PROFILE}/{profile_name}"
    clone_folder = f"{profile_name.replace(' ', '_')}_clone"
    profile_clone_path = f"{PATH_PROFILE_CLONE}/{clone_folder}"

    clone_chrome_profile(profile_path, profile_clone_path)

    profile["user_data_dir"] = PATH_PROFILE_CLONE + "/"
    profile["profile_directory"] = clone_folder

    if os.path.exists("screenshots"):
        shutil.rmtree("screenshots")
    os.makedirs("screenshots", exist_ok=True)

    client = get_mongo_client()
    collection = client["test"]["ads"]

    # Proxy
    proxy_host, proxy_port, proxy_user, proxy_pass = get_proxy_from_api()
    seleniumwire_options = None
    if all([proxy_host, proxy_port, proxy_user, proxy_pass]):
        seleniumwire_options = {
            "proxy": {
                "http": f"http://{proxy_user}:{proxy_pass}@{proxy_host}:{proxy_port}",
                "https": f"http://{proxy_user}:{proxy_pass}@{proxy_host}:{proxy_port}",
                "no_proxy": "localhost,127.0.0.1",
            }
        }

    user_agent, window = choose_user_agent_and_window(profile)
    print(f"[DEBUG] user_agent={user_agent}, window={window}, proxy={proxy_host}:{proxy_port}")

    options = uc.ChromeOptions()
    options.add_argument(f"--user-data-dir={profile['user_data_dir']}")
    options.add_argument(f"--profile-directory={profile['profile_directory']}")
    options.add_argument(f"--user-agent={user_agent}")
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--headless-new")

    driver = uc.Chrome(
        version_main=120,
        options=options,
        seleniumwire_options=seleniumwire_options,
        headless=False,
    )

    driver.set_window_size(*window)

    lang = profile.get("accept_language", "vi-VN")
    if "-" not in lang and len(lang) >= 2:
        lang = lang + "-" + lang.upper()
    primary = lang.split('-')[0]
    driver.execute_script(
        f"Object.defineProperty(navigator, 'language', {{get:()=>'{lang}'}});"
    )
    driver.execute_script(
        f"Object.defineProperty(navigator, 'languages', {{get:()=>['{primary}-{primary.upper()}','{primary}']}});"
    )

    total_ads, all_uploaded = 0, True

    for kw in keywords:
        keyword = kw["keyword"]
        for page in range(3):  # crawl 3 trang đầu
            try:
                delay = random.uniform(3, 5)
                time.sleep(delay)
                start = page * 10
                driver.get(f"https://www.google.com.vn/search?q={keyword}&start={start}")

                WebDriverWait(driver, 30).until(
                    EC.presence_of_element_located((By.XPATH,"//*[contains(text(),'Quảng cáo') or contains(text(),'Sponsored') or contains(text(),'Được tài trợ')]")))

                ad_blocks = driver.find_elements(By.XPATH,"//span[text()='Quảng cáo' or text()='Sponsored' or text()='Được tài trợ']/ancestor::div[@data-text-ad]")
                if not ad_blocks:
                    continue

                ads_data = []
                for ad in ad_blocks:
                    link, domain = None, None
                    for a in ad.find_elements(By.XPATH, ".//a[@href]"):
                        href = a.get_attribute("href")
                        if href and href.startswith("http"):
                            link, domain = extract_real_link_and_domain(href)
                            break
                    if not (link and domain):
                        continue

                    try:
                        advertiser = ad.find_element(By.XPATH, ".//span[contains(@data-dtld)]").text.strip()
                    except:
                        advertiser = domain

                    filename = f"{datetime.now().timestamp()}.png"
                    local_path = os.path.join("screenshots", filename)
                    if scroll_and_focus(driver, ad):
                        ad.screenshot(local_path)
                    else:
                        driver.save_screenshot(local_path)

                    uploaded = upload_to_r2(local_path, f"screenshots/{filename}")
                    if not uploaded:
                        all_uploaded = False

                    ads_data.append({
                        "profile_name": profile_name,
                        "keyword": keyword,
                        "link": link,
                        "domain": domain,
                        "advertiser": advertiser,
                        "screenshot_path": f"screenshots/{filename}" if uploaded else local_path,
                        "timestamp": datetime.now()
                    })

                if ads_data:
                    collection.insert_many(ads_data)
                    total_ads += len(ads_data)

                time.sleep(random.uniform(5, 12))

            except Exception as e:
                print(f"[Crawl Error] {keyword} (page {page + 1}): {e}")
                continue

    driver.quit()

    if all_uploaded and os.path.exists("screenshots"):
        shutil.rmtree("screenshots")

    return {"status": "done", "ads_collected": total_ads}