# agrosight/celery.py

import os
import ssl
from celery import Celery
from urllib.parse import urlparse

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "autobooks.settings")

app = Celery("autobooks")
app.config_from_object("django.conf:settings", namespace="CELERY")

# ✅ Enable SSL if using rediss://
REDIS_URL = os.getenv("REDIS_URL", "")
parsed = urlparse(REDIS_URL)

if parsed.scheme == "rediss":
    print("🔐 SSL enabled for Redis broker (Celery)")
    app.conf.broker_use_ssl = {
        "ssl_cert_reqs": ssl.CERT_NONE,
        "ssl_version": ssl.PROTOCOL_TLSv1_2,  # Enforce modern TLS
    }

app.autodiscover_tasks()
