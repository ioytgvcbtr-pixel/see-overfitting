"""Versioned, evidence-based transfer checks; forecasts are not mastery scores."""
import hashlib

def version(q):return q.get('assessment_version',1)

def legacy_reasons(q):
    seed=q['before_spec']['seed'];model=q['before_spec']['model']
    slot=int(hashlib.sha256(f'{seed}:{model}'.encode()).hexdigest()[:8],16)%3
    texts=['比较训练误差，以对已见样本的拟合作为新样本表现依据。','比较模型复杂程度，以模型能力作为本次验证表现依据。']
    texts.insert(slot,'比较同一验证群体的实算误差，把训练表现与模型复杂度另作解释。')
    return texts,slot

def direction(before,after):
    tolerance=1e-8+abs(before)*1e-6
    return 2 if abs(after-before)<=tolerance else 0 if after<before else 1

def prepare(q):
    if version(q)==1:
        q['reasons'],q['_reason']=legacy_reasons(q);return
    digest=hashlib.sha256((q['id']+':transfer-v2').encode()).hexdigest();kind=int(digest[:8],16)%3
    if kind==0:
        o=q['observations'];train=direction(o['before_training'],o['after_training']);valid=direction(o['before'],o['after']);words=['降低','升高','持平']
        def statement(t,v):return f'训练误差{words[t]}，验证误差{words[v]}；两项分开解释。'
        texts=[statement(train,valid),statement((train+1)%3,valid),statement(train,(valid+1)%3)]
        q['reason_question']='哪项描述与本题训练、验证读数一致？'
    elif kind==1:
        texts=['只说明本次同群体比较','可以用于所有相似数据的新样本','可以取代不同环境的验证评估']
        q['reason_question']=f"这次关于{q['change']['label']}的观察，适用范围是什么？"
    else:
        texts=['确认数据版本、目标与评估身份相同，再核对唯一变化的设置','只确认两组参数都处于合法范围','只确认两组模型属于相同家族']
        q['reason_question']=f"要解释{q['change']['label']}的影响，应该核对什么？"
    order=sorted(range(3),key=lambda i:hashlib.sha256((digest+str(i)).encode()).digest())
    q['reason_variant']=kind;q['reasons']=[texts[i] for i in order];q['_reason']=order.index(0)

def grade(q):
    answer=q['answer'];forecast=q['decision']['choice'];truth=q['_truth'];reason=answer['reason']==q['_reason']
    if version(q)==1:
        answer.update(passed=forecast==truth and reason,correct_choice=truth,correct_reason=q['_reason']);return
    matched=None if forecast==3 else forecast==truth
    understood=answer['interpretation']==truth and reason
    answer.update(prediction_matched=matched,interpretation_correct=answer['interpretation']==truth,reason_correct=reason,
        understanding_passed=understood,passed=understood,correct_choice=truth,correct_reason=q['_reason'])
