"""DeepSeek-only provider contract, shared by settings and every AI request."""
import os
from urllib.parse import urlsplit
BASE_URL='https://api.deepseek.com/v1'
MODELS=('deepseek-flash','deepseek-v4-pro')
EFFORTS=('none','low','high','max','xhigh')
def valid_base(value):
    try:
        u=urlsplit(value);return u.scheme=='https' and u.hostname=='api.deepseek.com' and u.port in (None,443) and u.path.rstrip('/') in ('','/v1') and not (u.username or u.password or u.query or u.fragment)
    except (ValueError,TypeError):return False
def provider_valid():return valid_base(os.environ.get('AI_BASE_URL',BASE_URL)) and os.environ.get('AI_MODEL','deepseek-flash') in MODELS
def requested_effort():
    value=os.environ.get('AI_REASONING_EFFORT','xhigh');return value if value in EFFORTS else 'xhigh'
def thinking_options():
    effort=requested_effort();return {'reasoning_effort':effort,'thinking':{'type':'disabled' if effort=='none' else 'enabled'}}
