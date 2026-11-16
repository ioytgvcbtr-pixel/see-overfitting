# 模力星球新增数据快照

CSV由`scripts/fetch_planet_datasets.py`从原作者/官方仓库下载并冻结，校验值、来源和转换后行数见`manifest.json`。原始来源、许可和课堂用途如下。

| 快照 | 行数 | 来源/许可 | 处理与用途 |
|---|---:|---|---|
| penguins | 344 | Palmer Penguins原作者，CC0 | 保留自然缺失、数值和类别变量；物种分类 |
| banknote | 1372 | UCI 267，CC BY 4.0 | 保留四个小波特征与原始类别码；未自造中文真假标签映射 |
| auto_raw | 398 | UCI 9，CC BY 4.0 | 保留6条马力缺失记录，原392条快照不改写 |
| energy | 768 | UCI 242，CC BY 4.0 | 公开物理仿真，八特征与供暖/制冷双目标；单位沿用原始说明，不自造 |
| bike | 731 | UCI 275，CC BY 4.0 | 使用day.csv日数据；按日期划分，ID、casual、registered不进入预测输入 |

- Penguins: https://allisonhorst.github.io/palmerpenguins/
- Banknote: https://archive.ics.uci.edu/dataset/267/banknote+authentication
- Auto MPG: https://archive.ics.uci.edu/dataset/9/auto+mpg
- Energy: https://archive.ics.uci.edu/dataset/242/energy+efficiency
- Bike: https://archive.ics.uci.edu/dataset/275/bike+sharing+dataset

图片资源不随数据许可一并复制。新增多标签案例由固定种子生成，另标“教学合成”，不作为实测数据。运行不再联网下载这些快照。
