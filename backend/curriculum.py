"""Original short lessons. Public sources support concepts; examples/copy are local teaching design."""
import hashlib,copy

CHAPTERS=[
 {'id':'start','title':'认识机器学习','subtitle':'从一个问题出发','palette':'orchid','icon':'compass'},
 {'id':'data','title':'把数据准备好','subtitle':'让实验站得住','palette':'meadow','icon':'database'},
 {'id':'models','title':'认识模型家族','subtitle':'选一种思考方式','palette':'lagoon','icon':'tree'},
 {'id':'evidence','title':'用证据做判断','subtitle':'让结论经得起比较','palette':'apricot','icon':'chart'},
 {'id':'frontier','title':'走向大模型','subtitle':'从表征到知识增强','palette':'indigo','icon':'orbit'},
 {'id':'practice','title':'理解前沿应用','subtitle':'从生成到可靠行动','palette':'sky','icon':'spark'},
]
SOURCES={
 'intro':('Google · Introduction to ML','https://developers.google.com/machine-learning/intro-to-ml'),
 'mlcc':('Google · Machine Learning Crash Course','https://developers.google.com/machine-learning/crash-course'),
 'clean':('scikit-learn · Common pitfalls','https://scikit-learn.org/stable/common_pitfalls.html'),
 'split':('scikit-learn · Cross-validation','https://scikit-learn.org/stable/modules/cross_validation.html'),
 'linear':('scikit-learn · Linear models','https://scikit-learn.org/stable/modules/linear_model.html'),
 'neighbors':('scikit-learn · Nearest neighbors','https://scikit-learn.org/stable/modules/neighbors.html'),
 'ensemble':('scikit-learn · Ensembles','https://scikit-learn.org/stable/modules/ensemble.html'),
 'metrics':('scikit-learn · Model evaluation','https://scikit-learn.org/stable/modules/model_evaluation.html'),
 'hf':('Hugging Face · LLM Course','https://huggingface.co/learn/llm-course/en/chapter1/1'),
 'tune':('Hugging Face · Fine-tuning','https://huggingface.co/learn/llm-course/en/chapter3/1'),
 'attention':('Attention Is All You Need','https://arxiv.org/abs/1706.03762'),
 'rag':('Retrieval-Augmented Generation','https://arxiv.org/abs/2005.11401'),
 'clip':('Learning Transferable Visual Models','https://arxiv.org/abs/2103.00020'),
 'diffusion':('Denoising Diffusion Probabilistic Models','https://arxiv.org/abs/2006.11239'),
 'agent':('ReAct','https://arxiv.org/abs/2210.03629'),
 'fair':('Google · Fairness','https://developers.google.com/machine-learning/crash-course/fairness'),
}
LESSONS=[]
def lesson(id,chapter,title,goal,parts,question,answers,correct,explanation,source,visual='pipeline',practice=None):
    options=[{'id':f'{id}-{i}','text':text} for i,text in enumerate(answers)]
    # Stable, varied presentation; answer identities survive reloads and backup.
    options.sort(key=lambda x:hashlib.sha256(x['id'].encode()).hexdigest())
    LESSONS.append(dict(id=id,chapter=chapter,title=title,goal=goal,sections=[{'title':h,'text':t} for h,t in parts],
        quiz={'question':question,'choices':options},_answer=f'{id}-{correct}',_explanation=explanation,
        sources=[{'title':SOURCES[k][0],'url':SOURCES[k][1]} for k in source],visual=visual,practice=practice,version=1))

lesson('ml-intro','start','什么是机器学习？','分清写规则与从样本中学习。',[
 ('从企鹅开始','想根据喙长、体重识别企鹅物种，可以由人写许多判断规则，也可以提供带物种标签的样本，让算法学习输入与目标之间的关系。训练得到的模型会把学到的关系用于新样本。'),
 ('模型在学习什么','以一条预测直线为例，模型调整系数与截距，让训练样本上的误差按目标函数减小。模型、学习算法、数据和评价标准各有职责；换一个数据集，学到的系数也可能改变。'),
 ('第一个判断','学习的价值在于对未参与训练的样本仍有用。背熟已见答案可能使训练表现漂亮，却无法说明新样本表现。先明确要预测什么，再决定是否适合机器学习。')],
 '机器学习实验首先要明确什么？',['界面使用哪种颜色','输入信息与要预测的目标','把模型参数尽可能调大'],1,'先明确输入与预测目标，才能定义任务、准备样本并选择评价方式。',['intro'],practice={'dataset':'penguins'})
lesson('task-types','start','分类、回归，还有聚类','按目标含义辨认任务。',[
 ('预测类别与数值','识别企鹅物种是分类，预测混凝土抗压强度是回归。类别可以编码成0或1，判断任务时看它表示类别还是数量，而不只看单元格是不是数字。'),
 ('多个输出','多分类中，一个样本从多个候选类别中选一个；多标签允许多个标签同时成立。多目标回归同时预测多个数值，每个目标都需要对应的单位和误差解释。'),
 ('没有标签时','聚类根据相似性组织样本，需要另行解释得到的分组。它与有标准标签的分类不同。本站表格实训提供分类与回归，多标签课例可观察标签组合。')],
 '一张图片可同时标有“猫”和“室内”，属于什么？',['多分类且只能选一个类别','单目标回归','多标签分类'],2,'多个标签可以同时成立，因此是多标签；多分类通常只选一个类别。',['intro'],visual='tasks',practice={'dataset':'labels'})
lesson('train-infer','start','训练与预测有什么区别？','认识参数、超参数与推理。',[
 ('两种阶段','训练利用样本估计模型参数，例如线性模型的系数。预测阶段把新输入送进已经训练好的处理链和模型，得到输出；单纯查看一个验证样本不会自动重新训练。'),
 ('你填写的设置','树的最大深度、KNN的邻居数、Ridge的α属于超参数，决定模型如何学习。它们和训练后得到的系数不是同一种东西。参数没有统一的“越大越好”规律。'),
 ('保留一次运行','改草稿后，旧结果仍属于旧配置。只有提交实际训练，才能得到新配置的结果。本站保存每次运行快照，方便核对输入、模型、超参数与输出。')],
 '只切换验证样本探针，应该发生什么？',['查看原模型对另一条样本的输出','自动重新训练全部模型','把当前测试集重新划入训练'],0,'查看样本是解释原运行；改变训练条件并重新训练才会产生新运行。',['mlcc'],practice={'dataset':'iris','model':'tree_c'})
lesson('features','data','特征、标签与数据质量','知道哪些信息能交给模型。',[
 ('输入与答案','企鹅的喙长等是输入特征，物种是目标标签。样本ID只负责标识记录，通常不能作为有意义的预测信息。若某列直接包含答案，加入模型会造成信息泄漏。'),
 ('先体检','检查缺失、常量列、重复输入、类别变量和异常值。目标缺失的记录不能随意填上答案后参与监督评分；同样输入却有不同标签的观测也不应按预测结果挑选保留。'),
 ('建立可复现版本','原始快照保持只读。选择列和清洗方法进入实验配置，来源、行身份与版本跟随结果保存。这样才能判断两次实验是否处理了同一群体。')],
 '单车需求cnt等于casual与registered之和，预测cnt时应怎样使用这两列？',['全部加入以提高得分','作为目标泄漏列排除','先看测试得分再决定'],1,'这两列可直接得到目标，不能作为未知需求预测时的输入。',['clean'],visual='data',practice={'dataset':'bike'})
lesson('splits','data','训练、验证、测试各管什么？','把选参和最终评估分开。',[
 ('三种职责','训练集用于学习模型及处理统计，验证集帮助比较方案与超参数，测试集用于锁定配置后的最终评估。比例需结合样本量与任务决定，三项合计100%。'),
 ('身份比比例重要','重复实体不应跨集合。时间相关任务需要保持先后关系，随机打散可能把未来信息带到过去。类别较少时还需核对每个集合的类别覆盖。'),
 ('探索与评估','反复依据测试结果改模型会让测试参与选参。交叉验证是在不同训练折内重复拟合与评估，不会让预处理可以先看全量数据。本站会记录样本的实际接触角色。')],
 '为什么不能反复看测试分数来挑超参数？',['因为测试参与了选参，失去原本的最终评估角色','因为验证集永远不需要标签','因为测试比例必须恰好20%'],0,'测试一旦用于选择方案，就参与了学习过程；应如实记录探索状态。',['split'],visual='split',practice={'dataset':'concrete'})
lesson('preprocess','data','清洗与缩放也要学习','只在当前训练子集拟合处理链。',[
 ('均值从哪里来','选择均值或中位数填补时，统计量只能从本次实际训练样本估计，再用于验证与测试。只使用训练池的25%时，处理器也只能使用这25%。'),
 ('尺度改变距离','体重和喙长的量纲不同。缩放会改变KNN或核方法的距离；树模型的反应可能不同。类别编码需要保留类别含义，名义类别的数字顺序不一定有意义。'),
 ('核对真正影响','清洗后查看训练样本处理前后、编码列与保留条数。只改一种处理方法，保持验证身份，再比较结果；不要把删除难验证样本后得到的高分当成改进。')],
 '用25%的训练池做样本量实验，填补中位数应从哪里计算？',['全部公开数据','完整训练池与验证集','本次实际采用的25%训练样本'],2,'每个训练子集都要重新拟合完整处理链，避免使用其余样本的信息。',['clean'],visual='data',practice={'dataset':'auto_raw','model':'ridge'})
lesson('linear','models','从线性模型到正则化','用系数解释预测，理解α。',[
 ('一组加权关系','线性回归把处理后的特征与系数相乘，再加截距形成预测。单个系数的含义依赖单位、缩放、其他特征和模型设定；相关性也不自动代表因果作用。'),
 ('给系数施加约束','Ridge通过惩罚限制系数，Lasso可使部分系数归零，ElasticNet组合不同惩罚。α控制约束强度；约束增强不意味着每份数据的验证误差都会降低。'),
 ('看见系数的影响','在约束花园观察系数、曲线和残差，再用同一划分的真实数据比较α。模型变简单和泛化变好是两件需要分别核对的事。')],
 '增大Ridge的α，能保证什么？',['所有验证指标必然提高','通常加强系数约束，效果仍需验证','证明每个特征都有因果作用'],1,'α控制约束；是否改善固定验证集表现，需要实算证据。',['linear'],visual='model',practice={'section':'concepts','panel':'regularization'})
lesson('local-models','models','邻居与核：局部怎样影响预测？','理解K与距离敏感性。',[
 ('KNN看哪些邻居','KNN根据处理后的全部输入寻找真实训练邻居，再投票或加权平均。二维图中的投影距离不能替代多特征空间中的距离。'),
 ('局部与平滑','较小的K更关注近处样本，较大的K汇集更广的邻域。RBF核用相似性构造非线性关系，γ改变距离影响的局部程度，C控制约束与拟合误差的取舍。'),
 ('保持比较条件','固定样本和处理方式，再改K或核设置。查看实际邻居、错分与条件切片，判断变化来自哪里。多特征切片需要说明其余输入固定的值。')],
 '多特征KNN的真实邻居由什么决定？',['二维图上肉眼看到的距离','类别名字的字母顺序','模型采用的全部处理后输入及距离规则'],2,'邻居由完整处理后空间中的距离确定，而不是二维投影上的直觉。',['neighbors'],visual='neighbors',practice={'dataset':'seeds','model':'knn_c'})
lesson('trees','models','决策树、森林与梯度提升','从一条路径走向集成。',[
 ('沿规则走到叶子','决策树依次比较特征与分裂阈值，将样本送到叶节点。限制树深或叶节点最少样本，可以改变规则的细致程度；解释时要用本次拟合得到的真实路径。'),
 ('多树共同预测','随机森林汇集多棵随机化树的结果，降低对单一树的依赖。它的最终输出需要全部树参与，只展示几棵树的票数不能代表完整集成。'),
 ('逐步修正','梯度提升让后续阶段修正先前模型的不足。学习率与阶段数共同影响学习过程。已有阶段输出可以画曲线，不能给没有逐轮过程的模型编造训练动画。')],
 '展示森林中前5棵树后，最终预测应怎样得到？',['依照已训练森林的全部树进行集成','只取画面上最漂亮的一棵树','用5棵树的截图代替计算'],0,'解释可抽取少量树，最终输出仍来自完整模型。',['ensemble'],visual='tree',practice={'dataset':'concrete','model':'forest_r'})
lesson('generalize','evidence','训练得好，为什么还会失败？','认识泛化、过拟合与分布变化。',[
 ('训练与新样本','模型可能学到稳定关系，也可能追随训练中的偶然噪声。复杂度增加通常更容易贴合训练数据，但新样本误差还受数据量、噪声、处理和模型假设影响。'),
 ('从曲线建立直觉','比较训练与验证结果，观察样本扰动如何牵动预测。一次种子下的现象是有限证据，多次复核能帮助了解波动，却不会自动生成统计置信区间。'),
 ('换个环境再想','训练期和应用期的分布可能不同，例如新的采集设备或不同时间段。保持同一验证集做受控比较后，还需在新情境检验结论能否迁移。')],
 '训练误差很低、验证误差较高时，合理的下一步是什么？',['仅凭训练得分宣布成功','直接删除验证中的难样本','核对过拟合、数据质量与条件，再做受控比较'],2,'先检查证据与条件，不能只用训练成绩代替泛化判断。',['mlcc'],visual='generalize',practice={'section':'concepts','panel':'sensitivity'})
lesson('metrics','evidence','读懂指标与错误类型','让指标对应你的任务。',[
 ('分类不只看准确率','类别不平衡时，多数类预测也可能有高准确率。混淆矩阵、按类召回、精确率与Macro-F1提供不同角度。二分类要先明确正类，才能解释漏检与误报。'),
 ('回归要看单位','RMSE、MAE与目标单位相同，R²可能为负。不同数据或不同单位的误差不能直接排名。多目标应分别展示，汇总前说明标准化方式。'),
 ('阈值也是决定','概率阈值改变会改变分类决策与错误类型，但不等于重训模型。SVM决策分数不是0到1的概率。图中单点用于诊断，整体指标仍按全部评估样本计算。')],
 '比较不同单位的两个回归任务，应该怎样判断？',['直接把RMSE更小者评为更好','先分别核对单位、基线与评估条件','只看训练集R²'],1,'误差有单位，需在对应任务、基线与相同评价条件下解释。',['metrics'],visual='evidence',practice={'dataset':'banknote','model':'logistic'})
lesson('controlled','evidence','一次只改一个决定','把结果变化变成可核验的证据。',[
 ('先定格A','保存一次已完成运行，写下预期。准备B时保持数据版本、验证身份、目标与指标一致，只改变一个参数或处理选择。'),
 ('区分两种变化','改训练池使用比例可以保持评估集不动；重新分配三份比例则可能更换评估群体。两组都能观察，但后者不能把差异全部归因到某个模型参数。'),
 ('让AI也接受核验','把AI建议当成待验证的假设：只执行合法的单项动作，核对实际结果支持还是不支持，再进入新情境。原始预测、辅助来源和失败尝试都值得保留。')],
 'A与B的验证样本不同，应该怎样展示？',['并列观察，并说明无法直接归因于单个超参数','隐藏样本差异后只排一个冠军','把两组结果当作严格配对实验'],0,'评估身份改变时应明确可比性边界，不制造单一因果解释。',['split'],visual='evidence',practice={'dataset':'concrete','model':'tree_r'})
lesson('transformers','frontier','神经网络与注意力','从加权组合走向上下文表征。',[
 ('多层变换','神经网络由多层可学习的变换组成，通过训练目标调整参数。深度和参数量提供表达能力，同时带来数据、优化和计算成本的要求。'),
 ('上下文中的联系','Transformer用注意力机制让表示依赖上下文中其他位置的信息。Token是模型处理的单位，可能是词片段；注意力权重也不应直接当成完整的因果解释。'),
 ('从认识到使用','语言模型可根据上下文生成后续内容，但流畅表达不保证事实正确。本课用概念图认识流程；本站表格实训使用已有传统模型，不在本机声称训练了大型Transformer。')],
 '注意力机制主要帮助模型做什么？',['保证每次回答都是真实事实','不需要任何训练样本','根据上下文建立不同位置之间的联系'],2,'注意力让表示依赖上下文关系，不提供事实正确性的保证。',['attention','hf'],visual='attention')
lesson('transfer','frontier','自监督、预训练与迁移','理解大模型为什么可以复用。',[
 ('从数据构造学习信号','自监督方法从数据本身设计预测或对比目标，学习可复用的表征。训练信号不一定来自人工为每条样本标注的任务答案。'),
 ('把已有能力带过来','预训练模型已经从一类训练目标中得到参数。下游任务可以使用其表征，也可以通过微调继续更新部分或全部参数；学习成本和效果需要具体评估。'),
 ('能力仍有边界','源数据与目标任务不同，迁移也可能不理想。小样本、标签质量、许可和评估泄漏仍然重要。使用大模型不会让原有的训练/验证规则失效。')],
 '微调通常意味着什么？',['针对任务继续更新模型的部分或全部参数','只给界面换配色','保证迁移后不再需要验证'],0,'微调涉及参数更新；仅在提示里补充上下文并不等同于微调。',['tune'],visual='transfer')
lesson('rag','frontier','提示、RAG与微调怎么选？','区分上下文、外部知识与参数更新。',[
 ('提示与上下文','提示给出任务、约束和示例，模型在当前上下文内生成结果。示例改变本次输入，不自动代表模型权重已被永久更新。'),
 ('先检索再生成','RAG先从外部资料检索相关内容，再把资料作为生成的上下文。知识可以通过更新资料库维护；检索遗漏、资料错误和生成误读仍需要核验。'),
 ('选择适合的路径','当任务需要可追溯的外部资料时，可考虑检索增强；需要改变特定行为时，微调可能值得研究。实际方案需要分别评估检索与生成，不能只看回答是否像真的。')],
 '知识库内容更新时，RAG系统首先应核对什么？',['把所有事实写死在界面里','资料入库、索引与检索是否正确更新','假定模型参数已经自动同步'],1,'RAG依赖外部资料与检索链；更新资料不等于模型参数自动更新。',['rag'],visual='rag')
lesson('multimodal','practice','多模态与生成模型','看懂对齐、条件与生成过程。',[
 ('不同信息进入同一任务','多模态系统可以组合图像、文本或声音等输入。表征对齐让不同模态的信息能互相匹配；相似性评分仍不是对内容真实性的证明。'),
 ('从噪声到图像','扩散模型通过学习去噪过程实现生成。文本等条件可以影响输出。界面中的星球插画属于固定生成资产，不能冒充由当前机器学习实验算出的样本或成绩。'),
 ('评价生成结果','除了画面好看，还要核对是否符合条件、是否有事实错误、使用权限与潜在偏差。教学插画负责帮助理解，实际数值图负责支持实验结论。')],
 'Q版星球插画与模型实验结果应该怎样关联？',['把插画中的装饰点当成真实预测','用插画数量当作课程成绩','插画表达主题，结果图与指标来自实际计算'],2,'装饰与证据职责不同，实验数值必须有真实计算来源。',['clip','diffusion'],visual='multimodal')
lesson('agents','practice','智能体为什么需要工具？','区分建议、行动与核验。',[
 ('让计划落到行动','工具型智能体将模型生成的计划与外部工具调用相连。工具返回的结果可以成为下一步上下文，循环执行仍需清楚的目标和停止条件。'),
 ('把边界写清楚','可以调用哪些工具、参数是否合法、操作是否需要授权，不能只由自然语言自我宣称。外部内容也可能不可靠，需要按任务和权限核对。'),
 ('用实验理解闭环','本站AI教练只提出可执行的合法变化，学生主动执行后，数值后端核验结果。建议被采纳与建议被证据支持分别记录，避免把一句承诺当成一次成功实验。')],
 'AI说“已经改善了模型”，还缺少什么？',['颜色更鲜艳的成功标识','实际执行与相同条件下的结果核验','再重复一次同样的话'],1,'行动需要真实工具执行，效果需要相同条件下的计算证据。',['agent'],visual='agent',practice={'dataset':'concrete','model':'tree_r'})
lesson('responsible','practice','把模型放到真实世界之前','核对分布、偏差与可追溯性。',[
 ('总体指标之外','整体表现可能掩盖不同群体或使用情境的差异。应结合实际任务检查数据代表性、错误分布和潜在影响，而不是只追求单一平均分数。'),
 ('保留证据链','记录数据来源、许可、配置、依赖、样本角色与模型输出。遇到新环境的分布变化，应重新评估。实验记录让别人知道结论基于哪次条件，而不是只看到一张漂亮截图。'),
 ('完成你的学习航线','回看一项自己的选择、对应实验与后续迁移。能说清哪里是观察、哪里是假设、哪里还未验证，比把每个参数都调大更有价值。完成短课检查后，再持续用真实课例练习。')],
 '整体准确率很高，部署前还应核对什么？',['不同情境的错误、数据代表性与证据来源','只看界面是否美观','清空不理想的实验记录'],0,'真实使用需要核对分组表现、数据与环境差异，以及结论的可追溯性。',['fair'],visual='evidence')

BY_ID={x['id']:x for x in LESSONS}
# Keep the exact old questions available for historical first answers and backups.
QUIZ_VERSIONS={l['id']:{1:copy.deepcopy({'quiz':l['quiz'],'answer':l['_answer'],'explanation':l['_explanation']})} for l in LESSONS}
from backend.knowledge_checks import CHECKS
_layout=sorted(LESSONS,key=lambda item:hashlib.sha256(('modelplanet-layout-v2:'+item['id']).encode()).digest())
_slots={item['id']:index%3 for index,item in enumerate(_layout)}
for index,l in enumerate(LESSONS):
    question,answers,correct,explanation=CHECKS[l['id']]
    options=[{'id':f"{l['id']}-v2-{i}",'text':text} for i,text in enumerate(answers)]
    right=options.pop(correct);options.insert(_slots[l['id']],right)
    l.update(quiz={'question':question,'choices':options},_answer=right['id'],_explanation=explanation,version=2)
    QUIZ_VERSIONS[l['id']][2]=copy.deepcopy({'quiz':l['quiz'],'answer':l['_answer'],'explanation':explanation})

def quiz_revision(lesson,version):return QUIZ_VERSIONS[lesson['id']].get(version)

def checked_attempt(lesson,attempt,fallback_version=1):
    version=attempt.get('quiz_version',fallback_version);revision=quiz_revision(lesson,version)
    choice=next((c for c in revision['quiz']['choices'] if c['id']==attempt['choice']),None) if revision else None
    return {**attempt,'quiz_version':version,'correct':bool(choice and attempt['choice']==revision['answer']),
            'choice_text':choice['text'] if choice else '原选项不可用','question_text':revision['quiz']['question'] if revision else ''}
def public_lesson(item):return {k:v for k,v in item.items() if not k.startswith('_')}
