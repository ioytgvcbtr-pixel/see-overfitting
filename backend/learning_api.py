import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from backend.experiments import Parameters
from backend import learning


class PredictionRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    parameters: Parameters
    choice: int = Field(ge=0, le=2)
    confidence: int = Field(default=2, ge=1, le=3)
    reason: str = Field(default='', max_length=500)


class TransferRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    task_id: str = Field(max_length=40)
    choice: int = Field(ge=0, le=2)
    reason: int = Field(ge=0, le=2)


def make_router(connect):
    router = APIRouter(prefix='/learning')

    def read(connection, attempt_id):
        row = connection.execute('SELECT content FROM learning_attempts WHERE id=?', (attempt_id,)).fetchone()
        if not row: raise HTTPException(404, '本轮学习记录不存在')
        return json.loads(row['content'])

    def write(connection, attempt):
        connection.execute('INSERT OR REPLACE INTO learning_attempts(id,content) VALUES (?,?)',
                           (attempt['id'], json.dumps(attempt, ensure_ascii=False)))

    @router.get('/history')
    def history():
        with connect() as connection:
            rows = connection.execute('SELECT content FROM learning_attempts ORDER BY rowid DESC LIMIT 50').fetchall()
        output = []
        for row in rows:
            attempt = learning.public(json.loads(row['content']))
            answers = attempt['transfer_attempts']
            output.append({key: attempt.get(key) for key in ('id', 'created_at', 'completed_at', 'parameters', 'last_parameters', 'stage', 'prediction')} |
                          {'observed_count': len(attempt['observations']), 'transfer_count': len(answers),
                           'first_transfer_passed': answers[0]['passed'] if answers else None,
                           'last_transfer_passed': answers[-1]['passed'] if answers else None,
                           'prediction_matched': attempt.get('prediction_review', {}).get('matched')})
        return output

    @router.post('/attempts/{attempt_id}/practice')
    def practice(attempt_id: str):
        with connect() as connection:
            attempt = read(connection, attempt_id)
            rows = connection.execute('SELECT content FROM learning_attempts').fetchall()
        seen = set()
        for row in rows:
            item = json.loads(row['content'])
            seen.add(item['parameters']['seed'])
            if item.get('_task'): seen.add(item['_task']['seed'])
            seen.update(answer['task']['seed'] for answer in item['transfer_attempts'])
        seed = (attempt['parameters']['seed'] + 307) % 1000000
        for _ in range(1000000):
            if seed not in seen: break
            seed = (seed + 307) % 1000000
        else: raise HTTPException(409, '已使用全部随机种子，请选择其他数据条件。')
        params = {**attempt['parameters'], 'seed': seed}
        return {'parameters': params, 'source_attempt_id': attempt_id}

    @router.post('/attempts')
    def begin(request: PredictionRequest):
        attempt = learning.start(request.parameters, request.choice, request.confidence, request.reason)
        with connect() as connection: write(connection, attempt)
        return learning.public(attempt)

    @router.get('/attempts/{attempt_id}')
    def restore(attempt_id: str):
        with connect() as connection: return learning.public(read(connection, attempt_id))

    @router.post('/attempts/{attempt_id}/observe')
    def observe(attempt_id: str, params: Parameters):
        with connect() as connection:
            connection.execute('BEGIN IMMEDIATE')
            attempt = read(connection, attempt_id)
            try: result = learning.observe(attempt, params)
            except ValueError as error: raise HTTPException(409, str(error))
            write(connection, attempt)
        return {'result': result, 'attempt': learning.public(attempt)}

    @router.post('/attempts/{attempt_id}/transfer')
    def transfer(attempt_id: str, request: TransferRequest):
        with connect() as connection:
            connection.execute('BEGIN IMMEDIATE')
            attempt = read(connection, attempt_id)
            try: learning.grade(attempt, request.task_id, request.choice, request.reason)
            except ValueError as error: raise HTTPException(409, str(error))
            write(connection, attempt)
        return learning.public(attempt)

    @router.post('/attempts/{attempt_id}/retry')
    def retry(attempt_id: str):
        with connect() as connection:
            connection.execute('BEGIN IMMEDIATE')
            attempt = read(connection, attempt_id)
            try: learning.retry_transfer(attempt)
            except ValueError as error: raise HTTPException(409, str(error))
            write(connection, attempt)
        return learning.public(attempt)

    return router
