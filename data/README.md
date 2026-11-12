# 数据说明

当前三个实验均使用合成数据：x ~ Uniform(0,1)，y = cos(1.5πx) + σ ε，ε ~ Normal(0,1)。每个seed经NumPy SeedSequence生成三个独立随机流。

- 训练池160条，取前N条作为当前训练集。
- 验证80条，只用于探索与选择参数。
- 测试120条，点击最终评估后才显示指标。
- 改模型阶数、Ridge系数不改变任何数据；改N只改变训练子集；改σ在同一噪声抽样上同时改变三组标签；改seed重抽三个独立流。

合成数据属于透明的教学条件，不伪装为真实用户数据。JSON报告包含实际训练点、验证点、拟合曲线、参数与指纹。

方法来源：https://scikit-learn.org/stable/auto_examples/model_selection/plot_underfitting_overfitting.html 。后续可选真实数据：https://archive.ics.uci.edu/dataset/186/wine+quality （CC BY 4.0），尚未纳入当前应用主流程。

fitlab.sqlite是运行时档案与报告数据库，由应用创建，并由.gitignore排除。
