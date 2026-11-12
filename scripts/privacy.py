"""Normalize local identifiers in public development records."""
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def path_pattern(path: str) -> str:
    return r'(?:\\+|/+)'.join(re.escape(part) for part in re.split(r'[\\/]+', path))


def rules():
    locations = [(str(ROOT), '<PROJECT_ROOT>'), (str(ROOT.parent), '<WORKSPACE>'),
                 (str(Path.home()), '<USER_HOME>'),
                 (str(Path(sys.executable).parent), '<PYTHON_ENV>')]
    return [(path_pattern(source), target) for source, target in locations if source]


def redact(text: str) -> str:
    for pattern, target in rules():
        text = re.sub(pattern, lambda _: target, text, flags=re.IGNORECASE)
    text = text.replace(Path.home().name, '<LOCAL_USER>')
    text = re.sub(r'''(?i)(?<![a-z0-9])[a-z]:(?:\\+|/+)(?=[^\\/"'\s:{}\[\]])''', '<LOCAL_ROOT>/', text)
    text = re.sub(r'(?i)\b[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\b', '<SESSION_ID>', text)
    text = re.sub(r'sk-[A-Za-z0-9_-]{12,}', '[REDACTED]', text)
    text = re.sub(r'(?i)(Bearer\s+)[A-Za-z0-9._-]{12,}', r'\1[REDACTED]', text)
    return text


def has_local_identifier(text: str) -> bool:
    return bool(re.search(r'''(?i)(?<![a-z0-9])[a-z]:(?:\\+|/+)(?=[^\\/"'\s:{}\[\]])''', text)) or Path.home().name in text
