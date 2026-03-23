"""
Django settings for the Autobooks project.
Standardized for professional hackathon submission.
"""

import os
import ssl
import dj_database_url
import warnings
from pathlib import Path
from datetime import timedelta
from urllib.parse import urlparse
from decouple import config, Csv
from corsheaders.defaults import default_headers

# Base Directory Definition
BASE_DIR = Path(__file__).resolve().parent.parent

# Core Security Settings
SECRET_KEY = config("SECRET_KEY")
DEBUG = config("DEBUG", cast=bool)
ALLOWED_HOSTS = config("ALLOWED_HOSTS", cast=Csv())

# Google Cloud Platform Configuration
GCP_CREDENTIALS = config("GOOGLE_APPLICATION_CREDENTIALS", default=None)
if GCP_CREDENTIALS:
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = GCP_CREDENTIALS.replace("\\", "/")

GCP_PROJECT = config("GCP_PROJECT_ID", default=None)
if GCP_PROJECT:
    os.environ["GCP_PROJECT_ID"] = GCP_PROJECT

# Task Queue Configuration (Celery / Redis)
CELERY_BROKER_URL = config("REDIS_URL", default=None)
CELERY_BROKER_USE_SSL = None

# Application Definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'cloudinary',
    'cloudinary_storage',
    'rest_framework',
    'rest_framework_simplejwt',
    'app.apps.AppConfig',
    'corsheaders',
]

# Middleware Configuration
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# Media Storage Configuration (Cloudinary)
CLOUDINARY_NAME = config('CLOUDINARY_NAME', default=None)
CLOUDINARY_API_KEY = config('CLOUDINARY_API_KEY', default=None)
CLOUDINARY_API_SECRET = config('CLOUDINARY_API_SECRET', default=None)

if CLOUDINARY_NAME and CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET:
    CLOUDINARY_STORAGE = {
        'CLOUD_NAME': CLOUDINARY_NAME,
        'API_KEY': CLOUDINARY_API_KEY,
        'API_SECRET': CLOUDINARY_API_SECRET,
    }
    DEFAULT_FILE_STORAGE = 'cloudinary_storage.storage.MediaCloudinaryStorage'
else:
    warnings.warn("Cloudinary credentials not configured. Falling back to local filesystem.")
    DEFAULT_FILE_STORAGE = 'django.core.files.storage.FileSystemStorage'

# Django REST Framework Settings
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_RENDERER_CLASSES': (
        'rest_framework.renderers.JSONRenderer',
    ),
}

# JWT Authentication Settings
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(days=1),
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
    "AUTH_TOKEN_CLASSES": ("rest_framework_simplejwt.tokens.AccessToken",),
    "ALGORITHM": "HS256",
    "SIGNING_KEY": SECRET_KEY,
    "TOKEN_OBTAIN_SERIALIZER": "app.serializers.CustomTokenObtainPairSerializer",
}

# Cross-Origin Resource Sharing (CORS)
CORS_ALLOWED_ORIGINS = config("CORS_ALLOWED_ORIGINS", cast=Csv())
CORS_ALLOW_HEADERS = list(default_headers) + [
    "x-latitude",
    "x-longitude",
    "x-refresh-token",
]

# URL and Template Configuration
ROOT_URLCONF = 'autobooks.urls'
WSGI_APPLICATION = 'autobooks.wsgi.application'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

# Database Persistence
ENV = config("ENV", default="local")

if ENV == "production":
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': config('DATABASE_NAME'),
            'USER': config('DATABASE_USER'),
            'PASSWORD': config('DATABASE_PASSWORD'),
            'HOST': config('DATABASE_HOST'),
            'PORT': config('DATABASE_PORT'),
        }
    }
else:
    DATABASES = {
        'default': dj_database_url.parse(config("DATABASE_URL"))
    }

# Cache Configuration
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.db.DatabaseCache',
        'LOCATION': 'agent_cache_table',
    }
}

# Password Validation
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# Web3 and Blockchain Integrations
SEPOLIA_RPC_URL = config("SEPOLIA_RPC_URL", default=None)
AGROSIGHT_CONTRACT_ADDRESS = config("AGROSIGHT_CONTRACT_ADDRESS", default=None)
WALLET_PRIVATE_KEY = config("WALLET_PRIVATE_KEY", default=None)

# Localization and Static Assets
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'static')
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Initialization Verification
if DEBUG:
    print(f"System Check: Secret key loaded (Prefix: {SECRET_KEY[:4]})")