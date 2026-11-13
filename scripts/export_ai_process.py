"""Export only public conversation and tool events from this task; never reasoning."""
import argparse
import hashlib
import json
import re
from datetime import datetime
from pathlib import Path
from privacy import redact

ROOT = Path(__file__).resolve().parents[1]


def read_entries(paths):
    """Merge rollout parts without duplicating the handoff user message."""
    entries = []
    for source, path in enumerate(paths):
        for line in path.read_text(encoding='utf-8').splitlines():
            entry = json.loads(line)
            if entry.get('type') == 'response_item':
                entries.append((entry, source))
    entries.sort(key=lambda row: row[0].get('timestamp', ''))
    seen, recent_messages = set(), {}
    for entry, source in entries:
        payload = entry.get('payload', {})
        serialized = json.dumps(payload, sort_keys=True, ensure_ascii=False)
        exact = (entry.get('timestamp'), hashlib.sha256(serialized.encode()).hexdigest())
        if exact in seen:
            continue
        seen.add(exact)
        if payload.get('type') == 'message':
            signature = hashlib.sha256(json.dumps([payload.get('role'), payload.get('channel'), payload.get('phase'), payload.get('content')], sort_keys=True, ensure_ascii=False).encode()).hexdigest()
            moment = datetime.fromisoformat(entry['timestamp'].replace('Z', '+00:00')).timestamp()
            previous = recent_messages.get(signature)
            if previous and previous[0] != source and abs(moment-previous[1]) < 2:
                continue
            recent_messages[signature] = (source, moment)
        yield entry


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--session', type=Path, nargs='+', required=True)
    args = parser.parse_args()
    directory = ROOT / 'docs' / 'ai-process'
    directory.mkdir(parents=True, exist_ok=True)
    messages = ['# 真实公开会话记录\n\n由当前会话脱敏导出，排除内部推理及系统指令。\n']
    events = []
    omitted_calls = set()
    reference_calls = set()
    asset_calls = set()
    active = False
    for entry in read_entries(args.session):
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
            # Discovery inventories and agent instructions are not project evidence.
            command = str(payload.get('input', payload.get('arguments', '')))
            if 'web__run' in command or 'web_run' in str(payload.get('name', '')) or any(marker in command for marker in ('tfReference', 'theoryReference', 'courseReference', 'rulesReviewTab', 'museumMathRef', 'museumExploreRef', 'conceptTheoryRef', 'conceptMomentumRef', 'rulesV07', 'node_modules/next/dist/docs')) or ('ui-ux-pro-max' in command and 'search.py' in command):
                reference_calls.add(payload.get('call_id'))
            if 'image_gen__imagegen' in command:
                asset_calls.add(payload.get('call_id'))
            if any(marker in command for marker in ('ALL_TOOLS', 'cua.getState(', 'cua.listApps(', 'cua.listWindows(', 'cua.listTabs(', 'browser.user.openTabs(', 'browser.tabs.list(', 'SKILL.md', 'RUNTIME-MATRIX.md')):
                omitted_calls.add(payload.get('call_id'))
                continue
            if payload.get('call_id') in omitted_calls:
                continue
            cleaned = {k: payload[k] for k in ('type', 'name', 'namespace', 'arguments', 'input', 'output', 'call_id') if k in payload}
            if payload.get('call_id') in reference_calls and 'output' in cleaned:
                cleaned['output'] = '[Reference lookup output omitted; source identifiers retained in call arguments.]'
            if payload.get('call_id') in asset_calls and 'output' in cleaned:
                cleaned['output'] = '[Generated asset preview omitted; prompts retained in call and final assets in public/illustrations.]'
            if 'output' in cleaned and any(marker in str(cleaned['output']) for marker in ('# Browser Safety', '## Computer Use', '## How to use the API')):
                cleaned['output'] = '[Tool runtime documentation omitted; project actions preserved in subsequent events.]'
            events.append(redact(json.dumps({'timestamp': entry.get('timestamp'), **cleaned}, ensure_ascii=False)))
    if not active:
        raise SystemExit('Project start prompt not found; existing evidence files were not modified.')
    for event in events:
        json.loads(event)
    conversation = '\n'.join(line.rstrip() for line in ''.join(messages).splitlines()).rstrip() + '\n'
    (directory / 'conversation.md').write_text(conversation, encoding='utf-8')
    (directory / 'tool-events.jsonl').write_text('\n'.join(events) + '\n', encoding='utf-8')
    print(f'Exported {len(messages)-1} public messages and {len(events)} tool events from {len(args.session)} session parts (redacted).')


if __name__ == '__main__':
    main()
