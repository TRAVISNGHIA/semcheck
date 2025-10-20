from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import schedule, threading, time, json, os
from datetime import datetime
from backend.api.crawlAds_api import crawl_ads

router = APIRouter()
CONFIG_FILE = "scheduler_config.json"

class SchedulerConfig(BaseModel):
    interval: int
    unit: str

def load_config():
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, "r") as f:
            data = json.load(f)
            return SchedulerConfig(**data)
    return SchedulerConfig(interval=3, unit="minutes")

def save_config(config: SchedulerConfig):
    with open(CONFIG_FILE, "w") as f:
        json.dump(config.dict(), f, indent=2)

scheduler_config = load_config()

def crawl_job():
    start_time = datetime.now()
    print(f"[Scheduler] Bắt đầu crawl: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
    try:
        crawl_ads()
        end_time = datetime.now()
        print(f"[Scheduler] Hoàn thành crawl: {end_time.strftime('%Y-%m-%d %H:%M:%S')}")
    except Exception as e:
        print(f"[Scheduler] Lỗi: {e}")

def schedule_job():
    schedule.clear("crawl_job")
    if scheduler_config.unit == "minutes":
        schedule.every(scheduler_config.interval).minutes.do(crawl_job).tag("crawl_job")
    elif scheduler_config.unit == "hours":
        schedule.every(scheduler_config.interval).hours.do(crawl_job).tag("crawl_job")
    elif scheduler_config.unit == "seconds":
        schedule.every(scheduler_config.interval).seconds.do(crawl_job).tag("crawl_job")
    print(f"[Scheduler] Đã thiết lập lại: {scheduler_config.interval} {scheduler_config.unit}")

schedule_job()

def run_scheduler():
    while True:
        schedule.run_pending()
        time.sleep(1)

threading.Thread(target=run_scheduler, daemon=True).start()

@router.get("/config")
def get_scheduler_config():
    return scheduler_config.dict()

@router.put("/config")
def update_scheduler_config(config: SchedulerConfig):
    if config.unit not in ["seconds", "minutes", "hours"]:
        raise HTTPException(status_code=400, detail="unit không hợp lệ")

    scheduler_config.interval = config.interval
    scheduler_config.unit = config.unit

    save_config(scheduler_config)
    schedule_job()

    return {"message": "Cập nhật thành công", "config": scheduler_config.dict()}
