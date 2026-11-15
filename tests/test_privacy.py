import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from privacy import has_local_identifier, redact


def test_nested_json_and_script_keys_are_preserved():
    event = {'input': r'text({q:\"search term\"});', 'path': str(Path.home() / 'example')}
    normalized = json.loads(redact(json.dumps(event)))
    assert normalized['input'] == event['input']
    assert '<USER_HOME>' in normalized['path']
    assert not has_local_identifier(json.dumps(normalized))


def test_windows_location_and_credentials_are_normalized():
    location = 'Z' + ':' + '\\' + 'example' + '\\' + 'file.txt'
    assert '<LOCAL_ROOT>' in redact(location)
    assert '[REDACTED]' in redact('sk-' + 'a' * 24)


def test_file_uri_is_normalized():
    from privacy import ROOT
    assert redact(ROOT.as_uri() + '/tests/example.mjs') == '<PROJECT_ROOT>/tests/example.mjs'


def test_signed_artifact_urls_are_not_published_in_process_logs():
    url='https://downloads.example/artifact?expires=123&sig=temporary-fixture'
    event={'result':{'download_url':url},'source':'https://github.com/example/project/actions/runs/123'}
    result=json.loads(redact(json.dumps(event)))
    assert result['result']['download_url']=='[TEMPORARY_DOWNLOAD_URL]'
    assert result['source']==event['source']
