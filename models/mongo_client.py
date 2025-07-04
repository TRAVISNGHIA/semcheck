from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv(dotenv_path="/home/nghia/WebstormProjects/semcheckerads/.env")

def get_mongo_client():
    mongo_uri = os.getenv("MONGO_URI")
    if not mongo_uri:
        raise Exception("MONGO_URI không tồn tại trong môi trường")
    return MongoClient(mongo_uri)
