import math
import os
import time
import random
import shutil
import requests
import boto3
import uuid
import socket
import stat
from datetime import datetime
from urllib.parse import urlparse, parse_qs

from fastapi import APIRouter, BackgroundTasks, Request
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from botocore.client import Config
from concurrent.futures import ThreadPoolExecutor, as_completed

import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

from models.keyword_model import get_all_keywords
from models.mongo_client import get_mongo_client
from models.profile_model import get_all_profiles

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

REDIS_KEY_LOCK = os.getenv("REDIS_KEY_LOCK", "crawl:lock")
REDIS_KEY_LATEST = os.getenv("REDIS_KEY_LATEST", "crawl:latest_run")
REDIS_KEY_PREFIX = os.getenv("REDIS_KEY_PREFIX", "crawl:status:")
REDIS_TTL_LOCK = int(os.getenv("REDIS_TTL", 60 * 60))
RUN_METADATA_TTL = int(os.getenv("RUN_METADATA_TTL", 60 * 60 * 24))


MAX_THREADS = int(os.getenv("THREAD_MAX", 2))

router = APIRouter()

def load_uas(path: str) -> list:
    if not path or not os.path.exists(path):
        return []
    with open(path, "r", encoding="utf-8") as f:
        return [line.strip() for line in f if line.strip()]

uas_mobile = load_uas(UA_MOBILE_FILE)
uas_tablet = load_uas(UA_TABLET_FILE)
uas_laptop = load_uas(UA_LAPTOP_FILE)

def choose_user_agent_and_window(profile: dict, keyword: str = None):
    if profile.get("user_agent"):
        ua = profile["user_agent"]
        if any(x in ua for x in ["Mobile", "iPhone", "Android"]):
            return ua, (390, 844)
        if any(x in ua for x in ["iPad", "Tablet", "SM-T", "Tab"]):
            return ua, (820, 1180)
        return ua, (1366, 768)

    device = (profile.get("device_type") or "").lower()
    if not device and keyword:
        k = keyword.lower()
        if any(w in k for w in ["mobile", "app", "android", "iphone"]):
            device = "mobile"
        elif any(w in k for w in ["ipad", "tablet", "tab"]):
            device = "tablet"
        else:
            device = "laptop"

    if device == "mobile":
        ua = random.choice(uas_mobile) if uas_mobile else ""
        win = (390, 844)
    elif device == "tablet":
        ua = random.choice(uas_tablet) if uas_tablet else ""
        win = (820, 1180)
    else:
        ua = random.choice(uas_laptop) if uas_laptop else ""
        win = (1366, 768)

    if not ua:
        ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"

    return ua, win

def upload_to_r2(local_path: str, remote_path: str) -> bool:
    if not all([R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_ENDPOINT_URL]):
        return False
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
        print("[R2 Upload Error]", e)
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
    try:
        r = requests.get(API_PROXY_URL, timeout=10)
        text = r.text.strip()

        if ":" in text and len(text.split(":")) == 4:
            return tuple(text.split(":"))

        data = r.json()
        px = data.get("proxyhttp")
        if px and len(px.split(":")) == 4:
            return tuple(px.split(":"))

        return (
            data.get("ip"),
            data.get("port"),
            data.get("username"),
            data.get("password"),
        )
    except Exception as e:
        print("[Proxy Error]", e)
        return None, None, None, None
def get_fresh_proxy_for_profile(profile_name: str, retry: int = 3):
    for i in range(retry):
        proxy_host, proxy_port, proxy_user, proxy_pass = get_proxy_from_api()

        if proxy_host and proxy_port:
            return proxy_host, proxy_port, proxy_user, proxy_pass

        time.sleep(1)

    print(f"[{profile_name}] NO PROXY (fallback)")
    return None, None, None, None

def extract_real_link_and_domain(href: str):
    if "google.com/aclk" in href or "google.com/url" in href:
        qs = parse_qs(urlparse(href).query)
        real = qs.get("adurl", qs.get("q", [href]))[0]
        return real, urlparse(real).netloc.replace("www.", "")
    return href, urlparse(href).netloc.replace("www.", "")

def scroll_and_focus(driver, element, timeout=5) -> bool:
    driver.execute_script("arguments[0].scrollIntoView({block:'center'});", element)
    time.sleep(random.uniform(0.3, 0.9))

    ActionChains(driver).move_to_element(element).pause(random.uniform(0.1, 0.5)).perform()

    end = time.time() + timeout
    while time.time() < end:
        try:
            if element.is_displayed() and element.size.get("height", 0) > 8:
                return True
        except: pass
        time.sleep(0.2)
    return False

def crawl_ads_internal(profile: dict, run_id: str = None, redis_client=None):
    client = None
    driver = None
    try:
        keywords = get_all_keywords()
        if not keywords:
            return {"status": "error", "error": "Không có keyword nào"}

        if not profile:
            return {"status": "error", "error": "No profile provided"}

        def get_or_create_clone(profile: dict):
            profile_name = profile.get("name", "").strip()
            if not profile_name:
                raise Exception("Profile name empty")

            clone_root = os.path.join(PATH_PROFILE_CLONE, profile_name)

            if not os.path.exists(clone_root):
                print(f"[CLONE] Create clone for {profile_name}")

                def ignore_singleton(dirpath, names):
                    return [n for n in names if n.startswith("Singleton")]

                shutil.copytree(PATH_PROFILE, clone_root, ignore=ignore_singleton)

                for name in [
                    "SingletonCookie", "SingletonLock",
                    "SingletonSocket", "SingletonLazyLock", "lockfile"
                ]:
                    p = os.path.join(clone_root, name)
                    if os.path.exists(p):
                        try:
                            os.remove(p)
                        except:
                            pass
            else:
                print(f"[CLONE] Reuse clone for {profile_name}")

            profile["user_data_dir"] = clone_root
            profile["profile_directory"] = profile_name
            profile["_clone_root"] = clone_root
            return profile

        profile = get_or_create_clone(profile)
        profile_name = profile.get("name", "").strip()
        ss_dir = "screenshots"
        if os.path.exists(ss_dir):
            try:
                shutil.rmtree(ss_dir)
            except Exception:
                pass
        os.makedirs(ss_dir, exist_ok=True)

        client = get_mongo_client()
        collection = client["test"]["ads"]

        proxy_host, proxy_port, proxy_user, proxy_pass = get_fresh_proxy_for_profile(profile_name)

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
        print(f"[{profile_name}] user_agent={user_agent}, window={window}, proxy={proxy_host}:{proxy_port}")

        options = uc.ChromeOptions()
        options.add_argument(f"--user-data-dir={profile['user_data_dir']}")
        options.add_argument(f"--profile-directory={profile['profile_directory']}")
        options.add_argument(f"--user-agent={user_agent}")
        options.add_argument("--disable-gpu")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        # options.add_argument("--headless=chrome")

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
        try:
            driver.execute_script(
                f"Object.defineProperty(navigator, 'language', {{get:()=>'{lang}'}});"
            )
            driver.execute_script(
                f"Object.defineProperty(navigator, 'languages', {{get:()=>['{primary}-{primary.upper()}','{primary}']}});"
            )
        except Exception:
            pass

        total_keywords = len(keywords)
        processed_local = 0

        if redis_client is not None and run_id is not None:
            run_key = f"{REDIS_KEY_PREFIX}{run_id}"
            try:
                redis_client.hset(run_key, mapping={
                    "message": f"Started for profile {profile_name}"
                })
            except Exception:
                pass

        total_ads = 0
        all_uploaded = True

        for kw in keywords:
            keyword = kw["keyword"]
            try:
                delay = random.uniform(3, 5)
                time.sleep(delay)
                driver.get(f"https://www.google.com.vn/search?q={keyword}")

                WebDriverWait(driver, 30).until(
                    EC.presence_of_element_located((By.XPATH, "//*[contains(text(),'Quảng cáo') or contains(text(),'Sponsored') or contains(text(),'Được tài trợ')]"))
                )

                ad_blocks = driver.find_elements(By.XPATH, "//span[text()='Quảng cáo' or text()='Sponsored' or text()='Được tài trợ']/ancestor::div[@data-text-ad]")
                if not ad_blocks:
                    if redis_client is not None and run_id is not None:
                        try:
                            run_key = f"{REDIS_KEY_PREFIX}{run_id}"
                            redis_client.hincrby(run_key, "processed_keywords", 1)
                            tot = int(redis_client.hget(run_key, "total_keywords") or total_keywords)
                            proc = int(redis_client.hget(run_key, "processed_keywords") or 0)
                            percent = int(proc * 100 / max(1, tot))
                            redis_client.hset(run_key, "progress", percent)
                            redis_client.hset(run_key, "message", f"{profile_name}: processed {proc}/{tot}")
                        except Exception:
                            pass
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
                    except Exception:
                        advertiser = domain

                    filename = f"{profile_name.replace(' ', '_')}_{datetime.now().timestamp()}.png"
                    local_path = os.path.join(ss_dir, filename)
                    try:
                        if scroll_and_focus(driver, ad):
                            ad.screenshot(local_path)
                        else:
                            driver.save_screenshot(local_path)
                    except Exception:
                            pass

                    uploaded = upload_to_r2(local_path, f"screenshots")
                    if not uploaded:
                        all_uploaded = False

                    ads_data.append({
                        "profile_name": profile_name,
                        "keyword": keyword,
                        "link": link,
                        "domain": domain,
                        "advertiser": advertiser,
                        "screenshot_path": f"screenshots" if uploaded else local_path,
                        "timestamp": datetime.now()
                    })

                if ads_data:
                    try:
                        collection.insert_many(ads_data)
                    except Exception as e:
                        print(f"[{profile_name}] [Mongo insert error]", e)
                    total_ads += len(ads_data)

                time.sleep(random.uniform(5, 12))

            except Exception as e:
                print(f"[{profile_name}] [Crawl Error] {keyword}: {e}")
            finally:
                processed_local += 1
                if redis_client is not None and run_id is not None:
                    try:
                        run_key = f"{REDIS_KEY_PREFIX}{run_id}"
                        redis_client.hincrby(run_key, "processed_keywords", 1)
                        tot = int(redis_client.hget(run_key, "total_keywords") or total_keywords)
                        proc = int(redis_client.hget(run_key, "processed_keywords") or 0)
                        percent = int(proc * 100 / max(1, tot))
                        redis_client.hset(run_key, "progress", percent)
                        redis_client.hset(run_key, "message", f"{profile_name}: processed {proc}/{tot}")
                    except Exception:
                        pass

        try:
            if driver:
                driver.quit()
        except:
            pass

        if all_uploaded and os.path.exists(ss_dir):
            try:
                shutil.rmtree(ss_dir)
            except Exception:
                pass

        if redis_client is not None and run_id is not None:
            try:
                run_key = f"{REDIS_KEY_PREFIX}{run_id}"
                redis_client.hset(run_key, mapping={
                    "message": f"{profile_name} done",
                    "last_profile_finish": profile_name
                })
            except Exception:
                pass

        return {"status": "done", "ads_collected": total_ads, "profile": profile_name}

    except Exception as e:
        print(f"[{profile.get('name','unknown')}] [crawl_ads_internal error]", e)
        try:
            if driver:
                driver.quit()
        except Exception:
            pass

        if redis_client is not None and run_id is not None:
            try:
                run_key = f"{REDIS_KEY_PREFIX}{run_id}"
                redis_client.hset(run_key, mapping={
                    "status": "error",
                    "message": f"{profile.get('name','unknown')}: {str(e)}",
                    "finish_ts": str(int(time.time()))
                })
            except Exception:
                pass

        return {"status": "error", "error": str(e), "profile": profile.get("name", "")}
    finally:
        try:
            if client:
                client.close()
        except Exception:
            pass

def crawl_multi_profiles(run_id: str, redis_client=None):
    keywords = get_all_keywords() or []
    total_keywords = len(keywords)

    profiles = get_all_profiles()
    valid_profiles = [
        p for p in profiles
        if os.path.exists(f"{PATH_PROFILE}/{p.get('name','').strip()}")
    ]
    if not valid_profiles:
        return {"status": "error", "error": "Không có profile hợp lệ"}

    num_workers = min(MAX_THREADS, len(valid_profiles))
    profiles_to_run = valid_profiles[:num_workers]

    if redis_client is not None and run_id is not None:
        run_key = f"{REDIS_KEY_PREFIX}{run_id}"
        try:
            redis_client.hset(run_key, mapping={
                "status": "running",
                "start_ts": str(int(time.time())),
                "progress": "0",
                "total_keywords": str(total_keywords),
                "processed_keywords": "0",
                "message": f"Starting {len(profiles_to_run)} profiles"
            })
            redis_client.expire(run_key, RUN_METADATA_TTL)
            redis_client.set(REDIS_KEY_LATEST, run_id, ex=RUN_METADATA_TTL)
        except Exception:
            pass

    results = []
    with ThreadPoolExecutor(max_workers=num_workers) as executor:
        futures = {executor.submit(crawl_ads_internal, p, run_id, redis_client): p for p in profiles_to_run}
        for future in as_completed(futures):
            profile_obj = futures[future]
            profile_name = profile_obj.get("name", "unknown")
            try:
                res = future.result()
                print(f" {profile_obj} ")
                results.append(res)
            except Exception as e:
                print(f"[MULTI] Profile {profile_name} exception: {e}")
                results.append({"status": "error", "profile": profile_name, "error": str(e)})

    if redis_client is not None and run_id is not None:
        try:
            run_key = f"{REDIS_KEY_PREFIX}{run_id}"
            redis_client.hset(run_key, mapping={
                "status": "done",
                "finish_ts": str(int(time.time())),
                "progress": "100",
                "message": "All profiles finished"
            })
        except Exception:
            pass

    return {"status": "done", "results": results}

def crawl_multi_worker(app, run_id):
    redis_client = getattr(app.state, "redis", None)
    try:
        res = crawl_multi_profiles(run_id, redis_client)
        print("[crawl_multi_worker result]", res)
    except Exception as e:
        print("[crawl_multi_worker exception]", e)
        if redis_client is not None:
            try:
                run_key = f"{REDIS_KEY_PREFIX}{run_id}"
                redis_client.hset(run_key, mapping={
                    "status": "error",
                    "message": str(e),
                    "finish_ts": str(int(time.time()))
                })
            except Exception:
                pass
    finally:
        try:
            if redis_client is not None:
                redis_client.delete(REDIS_KEY_LOCK)
        except Exception as e:
            print("[redis delete error]", e)

# ---- API endpoints ----
@router.post("/api/crawl")
def api_start_crawl(request: Request, background_tasks: BackgroundTasks):
    redis_client = getattr(request.app.state, "redis", None)
    if redis_client is None:
        return JSONResponse({"error": "Redis chưa cấu hình"}, status_code=500)

    run_id = uuid.uuid4().hex
    run_key = f"{REDIS_KEY_PREFIX}{run_id}"
    now_ts = int(time.time())
    meta = {
        "status": "accepted",
        "start_ts": str(now_ts),
        "progress": "0",
        "total_keywords": "0",
        "processed_keywords": "0",
        "message": "Accepted"
    }
    try:
        redis_client.hset(run_key, mapping=meta)
        # redis_client.expire(run_key, RUN_METADATA_TTL)
        redis_client.set(REDIS_KEY_LATEST, run_id, ex=RUN_METADATA_TTL)
    except Exception as e:
        try:
            redis_client.delete(REDIS_KEY_LOCK)
        except Exception:
            pass
        print("[redis hset error]", e)
        return JSONResponse({"error": "Redis error"}, status_code=500)

    background_tasks.add_task(crawl_multi_worker, request.app, run_id)
    return JSONResponse({"status": "accepted", "run_id": run_id}, status_code=202)

@router.get("/api/crawl_status")
def api_crawl_status(request: Request):
    redis_client = getattr(request.app.state, "redis", None)
    if redis_client is None:
        return JSONResponse({"status": "unknown", "error": "Redis not configured"}, status_code=500)

    try:
        run_id = redis_client.get(REDIS_KEY_LATEST)
    except Exception as e:
        print("[redis get latest error]", e)
        return JSONResponse({"status": "unknown", "error": "redis_error"}, status_code=500)

    if not run_id:
        lock = redis_client.get(REDIS_KEY_LOCK)
        if lock:
            return {"status": "running", "message": "Running (no run_id available)"}
        return {"status": "idle"}

    run_key = f"{REDIS_KEY_PREFIX}{run_id}"
    try:
        data = redis_client.hgetall(run_key) or {}
    except Exception as e:
        print("[redis hgetall error]", e)
        return JSONResponse({"status": "unknown", "error": "redis_error"}, status_code=500)

    status = data.get("status", "idle")
    progress = int(data.get("progress", "0") or 0)
    message = data.get("message", "")
    total_keywords = int(data.get("total_keywords", "0") or 0)
    processed_keywords = int(data.get("processed_keywords", "0") or 0)

    return {
        "status": status,
        "run_id": run_id,
        "progress": progress,
        "message": message,
        "total_keywords": total_keywords,
        "processed_keywords": processed_keywords
    }