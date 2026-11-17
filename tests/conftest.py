"""Keep test defaults away from the learner's database and API configuration."""
import os
import uuid
from pathlib import Path

private=Path(__file__).resolve().parents[1]/'artifacts/local'
os.environ['FITLAB_DB']=str(private/f'pytest-fallback-{uuid.uuid4().hex}.sqlite')
os.environ['FITLAB_ENV_FILE']=str(private/'pytest-no-api.env')
os.environ['AI_ENABLED']='0'
os.environ['AI_API_KEY']=''
