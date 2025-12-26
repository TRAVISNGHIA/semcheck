# backend/Dockerfile
FROM python:3.11

WORKDIR /app

COPY backend/requirements.txt .

COPY backend/.env .env

RUN python -m pip install --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Copy source
COPY backend .

ENV PYTHONUNBUFFERED=1

EXPOSE 8000

# Nếu dev muốn hot-reload: thay bằng ["uvicorn", "main:app", "--reload", "--host", "0.0.0.0", "--port", "8000"]
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

