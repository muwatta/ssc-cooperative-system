

import os
from celery import Celery
from django.conf import settings

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

app = Celery("SMS_cooperative")

# Load configuration from Django settings with CELERY namespace
app.config_from_object("django.conf:settings", namespace="CELERY")

# Auto-discover tasks from all registered Django apps
app.autodiscover_tasks()

# Task routing (optional, for advanced setups)
app.conf.task_routes = {
    "apps.*.tasks.*": {"queue": "default"},
}

# Task time limits
app.conf.task_time_limit = 30 * 60  # 30 minutes
app.conf.task_soft_time_limit = 25 * 60  # 25 minutes

@app.task(bind=True)
def debug_task(self):
    print(f"Request: {self.request!r}")
