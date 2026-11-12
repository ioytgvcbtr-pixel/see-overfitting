"""Export only public conversation and tool events from this task; never reasoning."""
import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT = Path(r"<LOCAL_ROOT>/Users\<LOCAL_USER>\.codex\sessions\2026\11\12\rollout-2026-11-12T16-58-51-<SESSION_ID>.jsonl")
START = '2026-11-12T13:40:00'


def redact(text: str) -> str:
    text = re.sub(r"sk-[A-Za-z0-9_-]{12,}", "[REDACTED]", text)
    text = re.sub(r"(?i)(Bearer\s+)[A-Za-z0-9._-]{12,}", r"\1[REDACTED]", text)
    return text


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--session', type=Path, default=DEFAULT)
    args = parser.parse_args()
    directory = ROOT / 'docs' / 'ai-process'
    directory.mkdir(parents=True, exist_ok=True)
    messages = ['# 真实公开会话记录\n\n由当前会话脱敏导出，排除内部推理及系统指令。\n']
    events = []
    active = False
    for line in args.session.read_text(encoding='utf-8').splitlines():
        entry = json.loads(line)
        if entry.get('type') != 'response_item':
            continue
        payload = entry.get('payload', {})
        kind = payload.get('type')
        if kind == 'message' and payload.get('role') in ('user', 'assistant'):
            # The runtime uses phase for public assistant messages; reasoning has its own type.
            if payload.get('channel') == 'analysis' or payload.get('phase') == 'analysis':
                continue
            body = '\n'.join(c.get('text', '') for c in payload.get('content', []) if c.get('type') in ('input_text', 'output_text'))
            if '那就做“看见过拟合”吧' in body:
                active = True
            if not active or not body:
                continue
            # Wrapper messages carrying policy/context are not user-authored prompts.
            if body.startswith('<environment_context>'):
                continue
            messages.append(f"\n## {entry.get('timestamp', '')} · {payload['role']}\n\n{redact(body)}\n")
        elif active and kind in ('function_call', 'function_call_output', 'custom_tool_call', 'custom_tool_call_output'):
            cleaned = {k: payload[k] for k in ('type', 'name', 'namespace', 'arguments', 'input', 'output', 'call_id') if k in payload}
            events.append(redact(json.dumps({'timestamp': entry.get('timestamp'), **cleaned}, ensure_ascii=False)))
    (directory / 'conversation.md').write_text(''.join(messages), encoding='utf-8')
    (directory / 'tool-events.jsonl').write_text('\n'.join(events) + '\n', encoding='utf-8')
    print(f'Exported {len(messages)-1} public messages and {len(events)} tool events (redacted).')


if __name__ == '__main__':
    main()
