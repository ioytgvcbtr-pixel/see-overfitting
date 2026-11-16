# 模力星球1.2学习路径与记录设计

统一左侧“我的学习记录”，移除主界面3/3。新增6章18课的“学习航线”，从什么是机器学习、分类/回归、训练与推理，到数据/划分/清洗、三类模型、泛化与评估，再到Transformer、自监督/迁移、RAG、多模态/扩散、工具智能体与可信应用。

每课是可直接阅读的原创讲解、主题图、短检查、练习入口与官方扩展资料。已打开、已读、检查通过分别保存；一课一格，重复进入不重复增加，全部通过才变为绿色完成标识。首答保留，复练另记。四个机制探索站使用独立4格，不用旧3门基础课推导新内容完成。

记录保存SQLite，包含知识状态、首次/复练答案、训练/分析/测试的真实任务快照，以及学生的主要配置更改和步骤访问。编辑记录合并同字段的连续输入并在离开字段/模块时保存；失败本机暂存后重试，服务端幂等接收。浏览器备份只含记录，不接受自报成绩。

移除学生CSV导入界面与创建数据接口，内置11个课例继续训练；原上传数据的历史可保留回放，不新增上传训练入口。备份JSON恢复与上传训练数据分开。

机制工坊用四站进度格、当前位置、继续入口替换松散记录；学习记录采用进度＋内容/实验/机制分类与可回放时间线。复用已有Q版星球，增加章节点、轨道、书页、知识电路等轻量SVG；留白、同高字段、44px目标和减少动效继续遵守。

资料于2026-11-16核对：Google MLCC/Intro to ML、scikit-learn处理/划分/模型/评估文档、Hugging Face LLM课程，以及Attention/RAG/CLIP/DDPM/ReAct原论文。前沿课程解释机制与适用边界，本机实训仍使用已实现的表格模型。

## 已实现的18课

| 章节 | 课题 | 学完能做什么 |
|---|---|---|
| 认识机器学习 | 什么是机器学习；分类/回归/聚类；训练与预测 | 说清输入、目标和学习/推理的区别 |
| 把数据准备好 | 特征/标签/质量；三份划分；训练内清洗与缩放 | 避免目标泄漏，制定可复现处理方案 |
| 认识模型家族 | 线性与正则化；邻居与核；树/森林/提升 | 理解主要参数控制的机制 |
| 用证据做判断 | 泛化与分布变化；指标与错误；受控实验 | 区分训练成绩、可比证据与迁移结论 |
| 走向大模型 | 神经网络/注意力；自监督/迁移；提示/RAG/微调 | 认识表征、上下文、外部知识与参数更新 |
| 理解前沿应用 | 多模态/扩散；工具型智能体；可信应用 | 区分图案、建议、真实执行与可核验结果 |

课程是可阅读的原创短讲解与小检查，适合先建立直觉，再进入对应实验或官方扩展资料。前沿部分明确为机制认知，不将其表述成本机已实现的大模型训练能力。

## 查阅依据

以下页面于2026-11-16核对。站内教学例子、顺序与界面为本项目设计；每课保留对应的官方或原论文链接。

- [Google Introduction to Machine Learning](https://developers.google.com/machine-learning/intro-to-ml)、[Machine Learning Crash Course](https://developers.google.com/machine-learning/crash-course)。
- scikit-learn：[处理常见问题](https://scikit-learn.org/stable/common_pitfalls.html)、[交叉验证](https://scikit-learn.org/stable/modules/cross_validation.html)、[线性模型](https://scikit-learn.org/stable/modules/linear_model.html)、[邻近方法](https://scikit-learn.org/stable/modules/neighbors.html)、[集成](https://scikit-learn.org/stable/modules/ensemble.html)、[评价指标](https://scikit-learn.org/stable/modules/model_evaluation.html)。
- [Hugging Face LLM Course](https://huggingface.co/learn/llm-course/en/chapter1/1)、[微调章节](https://huggingface.co/learn/llm-course/en/chapter3/1)。
- 原论文：[Attention](https://arxiv.org/abs/1706.03762)、[RAG](https://arxiv.org/abs/2005.11401)、[CLIP](https://arxiv.org/abs/2103.00020)、[DDPM](https://arxiv.org/abs/2006.11239)、[ReAct](https://arxiv.org/abs/2210.03629)。
- [Google Fairness](https://developers.google.com/machine-learning/crash-course/fairness)。
