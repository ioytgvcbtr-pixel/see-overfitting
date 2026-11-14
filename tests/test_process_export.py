import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from export_ai_process import read_entries, omit_binary_previews


def event(at, kind='message', **payload):
    return {'type':'response_item','timestamp':f'2026-11-13T12:{at}Z','payload':{'type':kind,**payload}}


def save(path, entries):
    path.write_text('\n'.join(json.dumps(entry) for entry in entries),encoding='utf-8')
    return path


def test_rollout_handoff_is_deduplicated_but_later_repeated_user_request_remains(tmp_path):
    prompt={'role':'user','content':[{'type':'input_text','text':'continue the same project'}]}
    start=event('00:00.000',**prompt)
    first=save(tmp_path/'first.jsonl',[start,event('00:01.000',role='assistant',content=[])])
    second=save(tmp_path/'second.jsonl',[event('00:00.018',**prompt),event('01:00.000',**prompt)])
    merged=list(read_entries([second,first]))
    assert len(merged)==3
    assert [row['timestamp'] for row in merged]==sorted(row['timestamp'] for row in merged)
    assert sum(row['payload'].get('role')=='user' for row in merged)==2


def test_exact_tool_replays_are_removed_and_distinct_output_chunks_preserved(tmp_path):
    a=event('00:00.000','function_call',call_id='call-a',name='example',arguments='{}')
    b=event('00:01.000','function_call_output',call_id='call-a',output='first chunk')
    c=event('00:02.000','function_call_output',call_id='call-a',output='second chunk')
    first=save(tmp_path/'first.jsonl',[a,b])
    second=save(tmp_path/'second.jsonl',[a,b,c])
    assert list(read_entries([first,second]))==[a,b,c]


def test_async_image_preview_is_removed_without_losing_text_or_failure_evidence():
    output = [
        {'type': 'input_text', 'text': 'Generation finished; saved project asset.'},
        {'type': 'input_image', 'image_url': 'data:image/png;base64,aGVsbG8=', 'detail': 'original'},
        {'type': 'input_text', 'text': 'Previous request failed; retry succeeded.'},
        {'metadata': {'preview': 'data:image/webp;base64,aGVsbG8=', 'width': 1536}},
    ]
    cleaned = omit_binary_previews(output)
    assert cleaned[0] == output[0] and cleaned[2] == output[2]
    assert cleaned[3]['metadata']['width'] == 1536
    assert 'data:image/' not in json.dumps(cleaned)
    assert output[1]['image_url'].startswith('data:image/')
