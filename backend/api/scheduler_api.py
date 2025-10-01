from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import schedule, threading, time
from datetime import datetime
from backend.api.crawlAds_api import crawl_ads

router = APIRouter()

class SchedulerConfig(BaseModel):
    interval: int
    unit: str

scheduler_config = SchedulerConfig(interval=3, unit="minutes")

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

# khởi tạo job default
schedule_job()

# chạy schedule loop trong thread riêng
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
    schedule_job()

    return {"message": "Cập nhật thành công", "config": scheduler_config.dict()}
