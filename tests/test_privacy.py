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
