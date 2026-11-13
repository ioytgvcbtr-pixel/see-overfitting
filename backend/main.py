import asyncio
import json
import os
import sqlite3
import uuid
from datetime import datetime
from pathlib import Path
from typing import Literal

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

from backend.experiments import Parameters, final_evaluation, run, sweep
from backend.coach import ai_status, explain
from backend.bench_api import router as bench_router
from backend.learning_api import make_router as learning_router
from backend.actions import make_router as actions_router
from backend import learning

ROOT = Path(__file__).resolve().parents[1]
for line in (ROOT / 'backend' / '.env').read_text(encoding='utf-8').splitlines() if (ROOT / 'backend' / '.env').exists() else []:
    if '=' in line and not line.startswith('#'):
        key, value = line.split('=', 1)
        os.environ.setdefault(key.strip(), value.strip())

DB_PATH = Path(os.environ.get('FITLAB_DB', str(ROOT / 'data' / 'fitlab.sqlite')))
app = FastAPI(title='看见过拟合 · FitLab', version='0.4.0')
app.include_router(bench_router)


def connect():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute('CREATE TABLE IF NOT EXISTS records (id INTEGER PRIMARY KEY, title TEXT, note TEXT, prediction TEXT, created_at TEXT, result TEXT)')
    connection.execute('CREATE TABLE IF NOT EXISTS reports (id TEXT PRIMARY KEY, content TEXT)')
    connection.execute('CREATE TABLE IF NOT EXISTS learning_attempts (id TEXT PRIMARY KEY, content TEXT)')
    connection.execute('CREATE TABLE IF NOT EXISTS action_plans (id TEXT PRIMARY KEY, content TEXT)')
    return connection


app.include_router(learning_router(connect))
app.include_router(actions_router(connect))


@app.get('/health')
def health():
    return {'status': 'ok', 'version': '0.4.0', **ai_status()}


@app.post('/experiments/run')
def experiment(params: Parameters):
    return run(params)


@app.post('/experiments/sweep')
def complexity_sweep(params: Parameters):
    return sweep(params)


@app.post('/experiments/final')
def evaluate_final(params: Parameters):
    return final_evaluation(params)


class RecordRequest(BaseModel):
    parameters: Parameters
    title: str = Field(default='我的实验', min_length=1, max_length=80)
    note: str = Field(default='', max_length=1000)
    prediction: str = Field(default='', max_length=200)


@app.get('/records')
def list_records():
    with connect() as connection:
        rows = connection.execute('SELECT * FROM records ORDER BY id DESC LIMIT 100').fetchall()
    return [{**dict(row), 'result': json.loads(row['result'])} for row in rows]


@app.post('/records')
def save_record(record: RecordRequest):
    result = run(record.parameters)
    timestamp = datetime.now().astimezone().isoformat(timespec='seconds')
    with connect() as connection:
        cursor = connection.execute('INSERT INTO records (title,note,prediction,created_at,result) VALUES (?,?,?,?,?)', (record.title, record.note, record.prediction, timestamp, json.dumps(result, ensure_ascii=False)))
        record_id = cursor.lastrowid
    return {'id': record_id, 'created_at': timestamp, 'result': result}


class CoachRequest(BaseModel):
    parameters: Parameters
    question: str = Field(default='解释当前实验，并建议下一步操作。', min_length=1, max_length=500)


class ReportRequest(BaseModel):
    parameters: Parameters
    final_evaluated: bool = False
    explanation: str = Field(default='', max_length=10000)
    explanation_mode: Literal['online', 'rules', 'none'] = 'none'
    explanation_model: str | None = Field(default=None, max_length=100)
    record_ids: list[int] = Field(default_factory=list, max_length=3)
    learning_progress: list[str] = Field(default_factory=list, max_length=3)
    learning_attempt_id: str | None = Field(default=None, max_length=40)
    action_plan_ids: list[str] = Field(default_factory=list, max_length=12)


@app.post('/reports')
def create_report(request: ReportRequest):
    result = run(request.parameters)
    with connect() as connection:
        rows = [connection.execute('SELECT * FROM records WHERE id=?', (record_id,)).fetchone() for record_id in request.record_ids]
        comparison = [{**dict(row), 'result': json.loads(row['result'])} for row in rows if row]
        report = {'title': '看见过拟合 · 实验报告', 'created_at': datetime.now().astimezone().isoformat(timespec='seconds'), 'experiment': result,
                  'final_evaluation': final_evaluation(request.parameters) if request.final_evaluated else None,
                  'coach': {'mode': request.explanation_mode, 'model': request.explanation_model, 'content': request.explanation},
                  'comparison': comparison, 'learning_progress': request.learning_progress,
                  'source': '合成数据 cos(1.5πx) + Gaussian noise; https://scikit-learn.org/stable/auto_examples/model_selection/plot_underfitting_overfitting.html'}
        report['learning_attempt'] = None
        if request.learning_attempt_id:
            row = connection.execute('SELECT content FROM learning_attempts WHERE id=?', (request.learning_attempt_id,)).fetchone()
            if not row: raise HTTPException(404, '学习记录不存在')
            attempt = json.loads(row['content'])
            if not learning.matches(attempt, request.parameters): raise HTTPException(409, '学习记录与当前固定条件不一致')
            report['learning_attempt'] = learning.public(attempt)
        report['verified_actions'] = []
        for plan_id in dict.fromkeys(request.action_plan_ids):
            row = connection.execute('SELECT content FROM action_plans WHERE id=?', (plan_id,)).fetchone()
            if row:
                saved = json.loads(row['content'])
                if saved['kind'] == 'synthetic' and saved['execution'] and learning.matches({'parameters': saved['baseline_parameters']}, request.parameters):
                    report['verified_actions'].append(saved['execution'])
        report_id = uuid.uuid4().hex
        connection.execute('INSERT INTO reports (id,content) VALUES (?,?)', (report_id, json.dumps(report, ensure_ascii=False)))
    return {'id': report_id, 'json_url': f'/reports/{report_id}.json', 'markdown_url': f'/reports/{report_id}.md'}


@app.get('/reports/{report_id}.{format}')
def download_report(report_id: str, format: Literal['json', 'md']):
    with connect() as connection:
        row = connection.execute('SELECT content FROM reports WHERE id=?', (report_id,)).fetchone()
    if not row:
        raise HTTPException(404, '报告不存在')
    report = json.loads(row['content'])
    if format == 'json':
        content = json.dumps(report, ensure_ascii=False, indent=2)
        media_type = 'application/json'
    else:
        result = report['experiment']
        content = '# 看见过拟合 · 实验报告\n\n时间：' + report['created_at'] + '\n\n## 参数与方法\n\n```json\n' + json.dumps(result['parameters'], ensure_ascii=False, indent=2) + '\n```\n\n' + result['method']
        content += '\n\n## 真实指标\n\n' + '\n\n'.join(f'{key}: {value:.8f}' for key, value in result['metrics'].items())
        content += '\n\n数据指纹：' + result['data_fingerprint'] + '\n\n训练/验证/测试：' + str(result['parameters']['samples']) + '/80/120，使用独立随机流。'
        final = report['final_evaluation']
        content += '\n\n## 独立测试\n\n' + (f"MSE: {final['test_mse']:.8f}。{final['note']}" if final else '尚未揭示独立测试结果。')
        content += '\n\n## 解释\n\n模式：' + report['coach']['mode'] + '\n\n' + (report['coach']['content'] or result['diagnosis']['description'])
        content += '\n\n## 记录对比\n\n' + ('\n'.join('- ' + item['title'] + ': ' + json.dumps(item['result']['metrics'], ensure_ascii=False) + '; ' + item['note'] for item in report['comparison']) or '未选择对比记录。')
        content += '\n\n## 来源\n\n' + report['source'] + '\n'
        if report.get('learning_attempt'):
            attempt = report['learning_attempt']
            content += '\n\n## 本轮学习记录\n\n' + json.dumps(attempt, ensure_ascii=False, indent=2)
        if report.get('verified_actions'):
            content += '\n\n## 建议执行与核验\n\n' + json.dumps(report['verified_actions'], ensure_ascii=False, indent=2)
        media_type = 'text/markdown'
    return Response(content, media_type=media_type, headers={'Content-Disposition': f'attachment; filename="FitLab-{report_id}.{format}"', 'Cache-Control': 'no-store'})


@app.get('/reports/{report_id}/preview')
def preview_report(report_id: str, format: Literal['json', 'md'] = 'json'):
    response = download_report(report_id, format)
    return {'content': response.body.decode('utf-8'), 'download_url': f'/reports/{report_id}.{format}'}


def rule_analysis(result):
    metrics, params = result['metrics'], result['parameters']
    return ('观察：训练MSE为{:.5f}，验证MSE为{:.5f}，差距为{:.5f}。\n\n解释：{}\n\n下一步：保持随机种子{}与其他参数不变，只改变一个变量，再保存两组实验比较。验证集用于选择，独立测试留到最后。').format(metrics['train_mse'], metrics['validation_mse'], metrics['gap'], result['diagnosis']['description'], params['seed'])


@app.post('/coach')
async def coach(request: CoachRequest):
    result = await asyncio.to_thread(run, request.parameters)
    evidence = {'parameters': result['parameters'], 'metrics': result['metrics'], 'diagnosis': result['diagnosis'], 'split': result['split'], 'fingerprint': result['data_fingerprint'], 'dataset': 'Synthetic cosine + Gaussian noise'}
    evidence['available_controls'] = ['degree', 'samples', 'noise', 'alpha', 'seed']
    return await explain(evidence, request.question, rule_analysis(result))
