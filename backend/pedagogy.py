"""Versioned question data. Observations are public; grading keys remain private."""
import copy
import math


def upgrade(task, form='comparison'):
    from backend import islands, concepts
    t = copy.deepcopy(task)
    p, panel = t['_proof'], t['panel']
    t.update(content_version=2, question_kind=form)
    if panel == 'sensitivity':
        columns = ['曲线变化RMS', '验证MSE']
        rows = [{'label':'道路A', 'values':[p['before'], p['a_validation']]},
                {'label':'道路B', 'values':[p['after'], p['b_validation']]}]
        correct = (f"比较验证MSE：A为{p['a_validation']:.4f}、B为{p['b_validation']:.4f}，不以曲线变化幅度替代。" if t['mode']=='counterexample' else
                   f"比较同次扰动的RMS：A为{p['before']:.4f}、B为{p['after']:.4f}，不以验证误差替代。")
        wrong = [('rms_as_accuracy', '优先选曲线变化RMS更小的道路，把稳定程度作为验证表现的依据。'),
                 ('complexity_as_evidence', '优先选阶数更高的道路，把表达能力作为本次变化幅度的依据。')]
    elif panel == 'forest':
        columns = ['训练准确率', '验证准确率']
        rows = [{'label':'切换前', 'values':[p['before_train'],p['before']]},
                {'label':'切换后', 'values':[p['after_train'],p['after']]}]
        correct = f"全体验证准确率从{p['before']:.1%}到{p['after']:.1%}；固定样本的纠正另作局部证据。"
        wrong = [('singlepoint_as_global', f"第{p['row']+1}件包裹已送对，用这个样本的改善代表全体验证表现。"),
                 ('training_as_validation', f"训练准确率从{p['before_train']:.1%}到{p['after_train']:.1%}，按已见样本的表现判断泛化。")]
    else:
        columns = ['训练MSE','验证MSE'] + (['系数范数'] if panel == 'regularization' else [])
        rows = [{'label':'调整前', 'values':[p['before_train'],p['before']] + ([p['before_norm']] if panel=='regularization' else [])},
                {'label':'调整后', 'values':[p['after_train'],p['after']] + ([p['after_norm']] if panel=='regularization' else [])}]
        correct = f"验证MSE从{p['before']:.4f}到{p['after']:.4f}，直接比较同一验证划分上的误差。"
        wrong = [('training_as_validation', f"训练MSE从{p['before_train']:.4f}到{p['after_train']:.4f}，按对已见样本的拟合程度判断泛化。"),
                 ('norm_as_validation' if panel=='regularization' else 'singlepoint_as_global',
                  f"系数范数从{p['before_norm']:.4f}到{p['after_norm']:.4f}，按收缩程度判断预测新样本的准确程度。" if panel=='regularization' else
                  '选择更贴近某个训练点的位置，把局部残差的改善作为泛化依据。')]
    for i,row in enumerate(rows):
        row['parameters'] = copy.deepcopy(t['target_parameters'] if panel=='sensitivity' or i else t['before_parameters'])
    t['assessment'] = {'columns':columns, 'rows':rows, 'percent':panel=='forest',
                       'note':'同一验证划分；每列独立从零起算，不跨量纲比较柱长。'}
    if panel == 'regularization' and form == 'model_selection':
        base = t['before_parameters']
        alphas = (.0001, .1, 100)
        results = [islands.calculate(panel,{**base,'alpha':a})['regularization']['current'] for a in alphas]
        rows = [{'label':f"{chr(65+i)} · α={a:g}", 'values':[r['train_mse'],r['validation_mse'],r['weight_norm']], 'parameters':{**base,'alpha':a}}
                for i,(a,r) in enumerate(zip(alphas,results))]
        winner = min(range(3), key=lambda i:results[i]['validation_mse'])
        t['assessment']['rows'] = rows
        t.update(question='按这次验证表现，下一轮保留哪个模型？', choices=['模型A','模型B','模型C'],
                 operation='三个模型使用相同样本、阶数与验证划分，只改变α。')
        t['target_parameters'] = {**base,'alpha':alphas[winner]}
        t['_proof'] = islands.evidence(panel,islands.calculate(panel,base),islands.calculate(panel,t['target_parameters']))
        t['_proof']['choice'] = winner
        correct = f"比较三者验证MSE，模型{chr(65+winner)}在这次划分上的值最低；独立测试集仍未使用。"
        train_best=min(range(3),key=lambda i:results[i]['train_mse'])
        norm_best=min(range(3),key=lambda i:results[i]['weight_norm'])
        wrong = [('training_as_validation', f"模型{chr(65+train_best)}训练MSE最低（{results[train_best]['train_mse']:.4f}），按训练拟合选择下一轮模型。"),
                 ('norm_as_validation', f"模型{chr(65+norm_best)}系数范数最小（{results[norm_best]['weight_norm']:.4f}），按更强收缩选择下一轮模型。")]
    elif panel == 'regularization' and form == 'controlled_design':
        t.update(question='要单独核验α的作用，下一步怎样设计更可靠？',
                 choices=['固定样本与阶数，只改变α','提高α，同时增加训练样本','提高α，同时降低多项式阶数'],
                 operation='观察这次结果，再选择一个能区分原因的后续实验。')
        # Rotate the correct operation so option position is not a cue.
        index = t['seed'] % 3
        choices = t['choices']; t['choices'] = choices[-index:]+choices[:-index] if index else choices
        t['_proof']['choice'] = index
        correct = '固定样本、噪声、阶数与验证划分，只改变α，才能把这次差异归到该操作。'
        wrong = [('confounded_design', '同时增加样本可以获得更多信息，因此能把变化单独归因于α。'),
                 ('confounded_design', '同时降低阶数可以抑制复杂度，因此能把变化单独归因于α。')]
    index = t['_reason']
    reasons = [v[1] for v in wrong]; tags = [v[0] for v in wrong]
    reasons.insert(index, correct); tags.insert(index, 'evidence_based')
    t['reasons'], t['_reason_tags'] = reasons, tags
    return t


def investigation(seed):
    from backend import islands
    base = {**islands.case('regularization','counterexample',seed)['before_parameters'], 'alpha':.0001}
    t = upgrade(islands.package('regularization','counterexample',base,{**base,'alpha':100},'alpha'))
    # Do not give the precomputed counterexample target to the learner.
    t.update(investigation=True, title='约束花园 · 自主寻找反例', question='你选的第一次α，会让验证MSE怎样变化？',
             operation='只改变α，寻找“系数范数下降、验证MSE升高”的反例。',
             target_parameters=copy.deepcopy(t['before_parameters']))
    t.pop('assessment',None)
    t['_proof'] = None
    return t


def trial(task, current):
    from backend import islands, concepts
    before = task['before_parameters']
    if current['alpha'] not in concepts.ALPHAS or current['alpha'] <= before['alpha']:
        raise ValueError('选择比起点更大的候选α。')
    if any(current[k] != before[k] for k in before if k != 'alpha'):
        raise ValueError('这次只改变α；样本、噪声、阶数和数据划分需要保持不变。')
    p = islands.evidence('regularization',islands.calculate('regularization',before),islands.calculate('regularization',current))
    return p | {'goal_met':p['after_norm'] < p['before_norm'] and p['after'] > p['before']}


def diagnosis(attempt):
    answer, task = attempt.get('transfer_answer'), attempt.get('_transfer')
    if not answer or not task:
        return {'tag':'open_hypothesis', 'label':'尚无迁移首答；核验当前猜想', 'submitted_answer':None}
    tag = ((task.get('_reason_tags') or ['unclassified']*3)[answer['reason']] if not answer['reason_correct'] else
           'direction_reading' if not answer['choice_correct'] else 'evidence_based')
    labels = {'training_as_validation':'区分训练拟合与新样本表现', 'norm_as_validation':'区分系数收缩与验证表现',
              'singlepoint_as_global':'区分单点与整体证据', 'rms_as_accuracy':'区分扰动幅度与预测误差',
              'complexity_as_evidence':'用实测变化核对模型复杂度直觉', 'confounded_design':'保持单变量实验',
              'direction_reading':'核对题目目标与数值方向', 'evidence_based':'换一个条件检验已有判断'}
    return {'tag':tag, 'label':labels.get(tag,'根据已提交首答提出待检验猜想'),
            'submitted_answer':{'choice':task['choices'][answer['choice']], 'reason':task['reasons'][answer['reason']],
                                'choice_correct':answer['choice_correct'], 'reason_correct':answer['reason_correct']},
            'status':'待检验线索，不是学生能力诊断'}


def action_observations(panel,before,after):
    if panel=='regularization':
        a,b=before['regularization']['current'],after['regularization']['current']
        return [{'metric':'系数范数','before':a['weight_norm'],'after':b['weight_norm']},
                {'metric':'训练MSE','before':a['train_mse'],'after':b['train_mse']}]
    if panel=='error':
        return [{'metric':'训练MSE','before':before['linear']['train_mse'],'after':after['linear']['train_mse']}]
    if panel=='sensitivity':
        return [{'metric':'模型B变化RMS','before':before['pairs'][1]['shift_rms'],'after':after['pairs'][1]['shift_rms']}]
    return [{'metric':'训练准确率','before':before['metrics']['train_accuracy'],'after':after['metrics']['train_accuracy']}]


def version3(panel, mode, seed, form='comparison', variant=0, autonomous=False):
    """Reconstructable v3: balanced model labels and evidence-neutral reasons."""
    from backend import islands, concepts
    raw = islands.case(panel,mode,seed)
    if form=='model_selection' and panel=='regularization':
        base={**raw['before_parameters'],'noise':(.06,.22,.55)[variant%3]}
        raw=islands.package(panel,mode,base,{**base,'alpha':100},'alpha')
    t=investigation(seed) if autonomous else upgrade(raw,form)
    t.update(content_version=3,variant=variant)
    ordinal=((42,43,44) if panel=='forest' else (2026,314,2718)).index(seed)
    if form=='model_selection' and not autonomous:
        base=t['before_parameters']
        path=islands.calculate(panel,base)['regularization']['path']
        best=min(path,key=lambda p:p['validation_mse'])
        alternatives=[p for p in path if not math.isclose(p['validation_mse'],best['validation_mse'],rel_tol=1e-7,abs_tol=1e-10)]
        if len(alternatives)<2: raise ValueError('当前候选近似并列，请换一组实验条件。')
        low=min(alternatives,key=lambda p:p['alpha'])
        high=max((p for p in alternatives if p['alpha']!=low['alpha']),key=lambda p:p['alpha'])
        winner=(ordinal+variant)%3
        candidates=[low,high];candidates.insert(winner,best)
        t['assessment']['rows']=[{'label':f"{chr(65+i)} · α={p['alpha']:g}",
            'values':[p['train_mse'],p['validation_mse'],p['norm']], 'parameters':{**base,'alpha':p['alpha']}}
            for i,p in enumerate(candidates)]
        t['target_parameters']={**base,'alpha':best['alpha']}
        t['_proof']=islands.evidence(panel,islands.calculate(panel,base),islands.calculate(panel,t['target_parameters']))
        t['_proof']['choice']=winner
        t['title']='约束花园 · 选择一个模型'
        t['context']+=f"；噪声σ={base['noise']:g}"
    # Reasons name a criterion, never the winning letter or numeric verdict.
    if form=='controlled_design':
        options=[('evidence_based','固定数据、阶数与验证划分，只改变α，才能区分这项操作的作用。'),
                 ('confounded_design','同时增加训练样本，利用更多信息判断α的独立作用。'),
                 ('confounded_design','同时降低模型阶数，利用更简单的模型判断α的独立作用。')]
    elif panel=='regularization':
        options=[('evidence_based','以固定验证集上的误差判断泛化，训练误差与系数范数分别用于解释。'),
                 ('training_as_validation','以训练误差较低作为选择标准，更充分地拟合已经见过的样本。'),
                 ('norm_as_validation','以系数范数较小作为选择标准，优先采用收缩更强的模型。')]
    elif panel=='error':
        options=[('evidence_based','比较同一验证集上的整体误差，将已见样本的拟合另作解释。'),
                 ('training_as_validation','比较训练集上的整体误差，将训练拟合作为新样本表现的依据。'),
                 ('singlepoint_as_global','比较当前浮标的残差，将该点的改善作为整体泛化的依据。')]
    elif panel=='forest':
        options=[('evidence_based','核对全体验证准确率，将固定包裹的纠正另作局部证据。'),
                 ('training_as_validation','核对训练准确率，将已见样本的表现作为整体泛化证据。'),
                 ('singlepoint_as_global','核对固定包裹是否送对，将该点的纠正作为整体提升证据。')]
    else:
        options=[('evidence_based','按题目目标分别比较RMS或验证MSE，扰动幅度与预测误差各自衡量。'),
                 ('rms_as_accuracy','按曲线变化RMS作判断，将稳定程度作为验证准确程度的依据。'),
                 ('complexity_as_evidence','按模型阶数作判断，将表达能力作为本次扰动幅度的依据。')]
    correct=(ordinal+variant+list(islands.NAMES).index(panel))%3
    ordered=options[1:];ordered.insert(correct,options[0])
    t['_reason']=correct;t['reasons']=[r[1] for r in ordered];t['_reason_tags']=[r[0] for r in ordered]
    return t
