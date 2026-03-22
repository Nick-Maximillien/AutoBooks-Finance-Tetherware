# Use Python 3.13 to match local system (3.13.2)
FROM python:3.13-slim

# Prevent python from writing pyc files and buffering stdout/stderr
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Set the working directory
WORKDIR /app

# Install system dependencies required for PostgreSQL and package building
RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .

# Force pip to 25.0.1 to match your local machine exactly
RUN pip install --upgrade pip==25.0.1

# Install requirements with no cache
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .

# Run the web service on container startup using gunicorn.
# Matches your WSGI configuration for the Autobooks app
# Run migrations, THEN start the web service
CMD python manage.py migrate && exec gunicorn autobooks.wsgi:application --bind 0.0.0.0:$PORT --workers 1 --threads 8 --timeout 0