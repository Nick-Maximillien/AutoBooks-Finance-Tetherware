import logging
import requests
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from django.conf import settings

from .models import BusinessProfile

User = get_user_model()
logger = logging.getLogger(__name__)

@receiver(post_save, sender=User)
def create_business_profile(sender, instance, created, **kwargs):
    if created:
        profile, _ = BusinessProfile.objects.get_or_create(user=instance)
        profile.initialize_ifrs_accounts()
        # Web3 opt-in is via ActivateWeb3View.

