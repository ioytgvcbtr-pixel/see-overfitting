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
