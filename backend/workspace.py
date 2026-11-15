"""Local workspace overview and write-only model configuration."""
import hashlib
import json
import os
from pathlib import Path
from urllib.parse import urlsplit

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator

from backend import coach, islands, learning

ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = Path(os.environ.get('FITLAB_ENV_FILE', str(ROOT / 'backend' / '.env')))
CONNECTION = {'state': 'untested', 'checked_at': None, 'notice': '', 'fingerprint': ''}
SCENES = {'complexity': '模型复杂度', 'samples': '训练样本量', 'regularization': '正则化'}
STAGES = {'predict': '待预测', 'experiment': '实验中', 'review': '待迁移', 'transfer': '待迁移', 'complete': '已完成', 'planned': '待执行'}


def fingerprint():
    return hashlib.sha256(json.dumps([os.environ.get(k, '') for k in ('AI_BASE_URL', 'AI_MODEL', 'AI_API_KEY', 'AI_ENABLED')]).encode()).hexdigest()


def connection_status():
    if os.environ.get('AI_ENABLED', '1') == '0':
        return {'state': 'disabled', 'checked_at': None, 'notice': '当前使用规则讲解，模型配置已保留。'}
    if not os.environ.get('AI_API_KEY'):
        return {'state': 'unconfigured', 'checked_at': None, 'notice': '实验与学习可直接使用，AI连接可稍后设置。'}
    if CONNECTION['fingerprint'] != fingerprint():
        return {'state': 'untested', 'checked_at': None, 'notice': '已配置，尚未进行连接测试。'}
    return {k: CONNECTION[k] for k in ('state', 'checked_at', 'notice')}


class Settings(BaseModel):
    model_config = ConfigDict(extra='forbid')
    base_url: str = Field(min_length=8, max_length=300)
    model: str = Field(min_length=1, max_length=100, pattern=r'^[a-zA-Z0-9._:/-]+$')
    enabled: bool = True
    api_key: str | None = Field(default=None, max_length=512)
    timeout: int = Field(default=90, ge=10, le=120)
    max_tokens: int = Field(default=8192, ge=1024, le=32768)

    @field_validator('base_url')
    @classmethod
    def url(cls, value):
        p = urlsplit(value.strip())
        if p.username or p.password or p.query or p.fragment or not p.hostname:
            raise ValueError('请填写不含凭据或查询参数的服务地址。')
        if p.scheme != 'https' and not (p.scheme == 'http' and p.hostname in ('127.0.0.1', 'localhost')):
            raise ValueError('远程模型服务请使用HTTPS。')
        return value.strip().rstrip('/')

    @field_validator('api_key')
    @classmethod
    def key(cls, value):
        if value is None or not value.strip(): return None
        if any(c.isspace() for c in value) or len(value) < 12:
            raise ValueError('密钥格式不完整。')
        return value


def settings_public():
    return {'base_url': os.environ.get('AI_BASE_URL', 'https://api.deepseek.com/v1'),
            'model': os.environ.get('AI_MODEL', 'deepseek-flash'),
            'enabled': os.environ.get('AI_ENABLED', '1') != '0', 'key_configured': bool(os.environ.get('AI_API_KEY')),
            'timeout': int(os.environ.get('AI_TIMEOUT', '90')), 'max_tokens': int(os.environ.get('AI_MAX_TOKENS', '8192')),
            'reasoning_effort': 'xhigh', 'connection': connection_status()}


def save_settings(request):
    values = {'AI_BASE_URL': request.base_url, 'AI_MODEL': request.model, 'AI_ENABLED': '1' if request.enabled else '0',
              'AI_TIMEOUT': str(request.timeout), 'AI_MAX_TOKENS': str(request.max_tokens), 'AI_REASONING_EFFORT': 'xhigh'}
    if request.api_key: values['AI_API_KEY'] = request.api_key
    lines = ENV_PATH.read_text(encoding='utf-8').splitlines() if ENV_PATH.exists() else []
    output = []
    remaining = values.copy()
    for line in lines:
        key = line.split('=', 1)[0].strip() if '=' in line and not line.lstrip().startswith('#') else ''
        if key in values:
            if key in remaining: output.append(key + '=' + remaining.pop(key))
        else: output.append(line)
    output.extend(key + '=' + value for key, value in remaining.items())
    ENV_PATH.parent.mkdir(parents=True, exist_ok=True)
    temporary = ENV_PATH.with_name(ENV_PATH.name + '.tmp')
    temporary.write_text('\n'.join(output).rstrip()+'\n', encoding='utf-8')
    temporary.replace(ENV_PATH)
    os.environ.update(values)
    CONNECTION.update(state='untested', checked_at=None, notice='', fingerprint='')
    return settings_public()


async def test_connection():
    status = connection_status()
    if status['state'] in ('disabled', 'unconfigured'): return status
    payload = {'model': os.environ.get('AI_MODEL', 'deepseek-flash'),
               'messages': [{'role': 'user', 'content': '这是连接测试，请只回复OK。'}],
               'max_tokens': 1024, 'reasoning_effort': 'xhigh', 'thinking': {'type': 'enabled'}, 'stream': False}
    try:
        async with httpx.AsyncClient(timeout=min(30, int(os.environ.get('AI_TIMEOUT', '90')))) as client:
            response = await client.post(os.environ.get('AI_BASE_URL', 'https://api.deepseek.com/v1').rstrip('/')+'/chat/completions',
                                         headers={'Authorization': 'Bearer '+os.environ['AI_API_KEY']}, json=payload)
        if response.is_success and isinstance(response.json().get('choices'), list) and response.json()['choices']:
            state, notice = 'ok', '模型接口已响应，连接测试通过。'
        else:
            state, notice = 'failed', f'模型接口未通过测试（HTTP {response.status_code}），可继续使用规则讲解。'
    except (httpx.HTTPError, ValueError, KeyError):
        state, notice = 'failed', '连接测试未完成，请检查服务地址与网络；实验功能仍可使用。'
    CONNECTION.update(state=state, notice=notice, checked_at=learning.now(), fingerprint=fingerprint())
    return connection_status()


def read_items(connection, table):
    return [json.loads(r['content']) for r in connection.execute(f'SELECT content FROM {table} ORDER BY rowid DESC').fetchall()]


def overview(connection):
    items, courses, rounds, review_count = [], set(), 0, 0
    for s in read_items(connection, 'learning_attempts'):
        visible = learning.public(s)
        wrong = visible.get('prediction_review', {}).get('matched') is False or any(not a['passed'] for a in s['transfer_attempts'])
        if s['stage'] == 'complete': courses.add(s['parameters']['scene'])
        stamp = s.get('completed_at') or (s['transfer_attempts'][-1]['submitted_at'] if s['transfer_attempts'] else None) or (s['observations'][-1]['observed_at'] if s['observations'] else s['created_at'])
        items.append({'kind': 'course', 'id': s['id'], 'title': SCENES[s['parameters']['scene']], 'scene': s['parameters']['scene'],
                      'stage': s['stage'], 'status': STAGES[s['stage']], 'updated_at': stamp, 'needs_review': wrong,
                      'imported': bool(s.get('imported_at'))})
    for s in read_items(connection, 'island_attempts'):
        if not s.get('prediction') and s.get('protocol_version', 1) < 2: continue
        passed = s.get('transfer_answer', {}).get('passed') if s.get('transfer_answer') else None
        wrong = passed is False or (s.get('observation') or {}).get('matched') is False
        if s['stage'] == 'complete': rounds += 1
        items.append({'kind': 'island', 'id': s['id'], 'title': islands.NAMES[s['panel']], 'panel': s['panel'], 'mode': s['mode'],
                      'stage': s['stage'], 'status': ('迁移通过' if passed else '迁移需复练') if s['stage'] == 'complete' else STAGES[s['stage']],
                      'updated_at': s.get('updated_at') or s.get('completed_at') or (s.get('observation') or {}).get('observed_at') or s['created_at'],
                      'needs_review': wrong, 'assisted': bool(s['hints_used'] or s['ai_before_transfer']), 'imported': bool(s.get('imported_at'))})
    for table, kind in (('action_plans', 'course_ai'), ('island_actions', 'island_ai')):
        for s in read_items(connection, table):
            execution = s.get('execution')
            items.append({'kind': kind, 'id': s['id'], 'title': s['change']['label'], 'stage': 'complete' if execution else 'planned',
                          'status': {'supported': '支持预期', 'not_supported': '不支持预期', 'observed': '记录观察'}.get((execution or {}).get('verdict'), '待执行'),
                          'updated_at': (execution or {}).get('executed_at') or s['created_at'], 'needs_review': (execution or {}).get('verdict') == 'not_supported',
                          'attempt_id': s.get('attempt_id') or s.get('learning_attempt_id'), 'panel': s.get('panel'),
                          'imported': bool(s.get('imported_at')), 'mode': s.get('mode')})
    for r in connection.execute('SELECT * FROM records ORDER BY id DESC').fetchall():
        items.append({'kind': 'saved', 'id': str(r['id']), 'title': r['title'], 'stage': 'complete', 'status': '已保存实验',
                      'updated_at': r['created_at'], 'needs_review': False})
    items.sort(key=lambda row: row['updated_at'], reverse=True)
    learning_items = [i for i in items if i['kind'] in ('course', 'island')]
    latest = next((i for i in learning_items if i['stage'] != 'complete'), learning_items[0] if learning_items else None)
    review_count = sum(i['needs_review'] for i in learning_items)
    return {'items': items[:150], 'latest': latest, 'completed_scenes': sorted(courses),
            'stats': {'courses': len(courses), 'island_rounds': rounds, 'needs_review': review_count}}


def make_router(connect):
    router = APIRouter(prefix='/workspace')

    @router.get('/overview')
    def get_overview():
        with connect() as connection: return overview(connection)

    @router.get('/settings')
    def get_settings(): return settings_public()

    @router.post('/settings')
    def update_settings(request: Settings): return save_settings(request)

    @router.post('/settings/test')
    async def check_connection(): return await test_connection()

    @router.get('/evidence/{kind}/{key}')
    def get_evidence(kind: str, key: str):
        table = {'course_ai': 'action_plans', 'island_ai': 'island_actions'}.get(kind)
        if not table: raise HTTPException(404, '没有这类核验记录。')
        with connect() as connection:
            row = connection.execute(f'SELECT content FROM {table} WHERE id=?', (key,)).fetchone()
        if not row: raise HTTPException(404, '核验记录不存在。')
        s = json.loads(row['content'])
        proof = s.get('execution')
        if kind == 'course_ai' and proof:
            proof = {'before': proof['before']['metrics'][proof['metric']], 'after': proof['after']['metrics'][proof['metric']],
                     'metric': {'validation_mse':'验证MSE','validation_rmse':'验证RMSE'}.get(proof['metric'],proof['metric']), 'verdict': proof['verdict'], 'executed_at': proof['executed_at']}
        return {k: s.get(k) for k in ('id', 'hypothesis', 'expected', 'change', 'baseline_parameters', 'target_parameters', 'mode', 'model', 'notice', 'imported_at')} | {'proof': proof}

    return router
