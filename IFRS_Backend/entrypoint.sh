#!/bin/bash

set -e

echo " Waiting for PostgreSQL to be ready..."
until pg_isready -h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "$DATABASE_USER"; do
  >&2 echo " Postgres is unavailable - sleeping"
  sleep 2
done

echo " PostgreSQL is up - continuing..."

echo " Applying database migrations..."
python manage.py migrate --noinput

echo " Collecting static files..."
python manage.py collectstatic --noinput

echo " Starting Gunicorn..."
exec gunicorn autobooks.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers 3 \
    --threads 2 \
    --timeout 120 \
    --log-level info
