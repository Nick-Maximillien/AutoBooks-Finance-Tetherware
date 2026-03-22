# Stage 1: Build base image with dependencies
FROM python:3.11-slim as base

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install system and Python dependencies
COPY requirements.txt requirements.txt

RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    curl \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir -r requirements.txt

# Stage 2: Final image (optional for production)
FROM base as final

WORKDIR /app
COPY . .

# Add concurrency tuning for WSL2/dev
CMD ["celery", "-A", "autobooks", "worker", "--loglevel=info", "--concurrency=4", "--pool=solo"]
