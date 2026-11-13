# 分类教学快照

| 数据 | 记录 | 原始特征 | 此处使用 | 原作者与来源 |
|---|---:|---:|---|---|
| Iris | 150 | 4 | 花瓣长、花瓣宽（cm） | Fisher, R. (1936). [UCI](https://archive.ics.uci.edu/dataset/53/iris), DOI:10.24432/C56C76 |
| Seeds | 210 | 7 | 籽粒面积、沟槽长；UCI未在变量表给出单位，保留原始单位 | Charytanowicz, M. et al. (2010). [UCI](https://archive.ics.uci.edu/dataset/236/seeds), DOI:10.24432/C5H30K |

两者采用[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)。公开文件保留全部原始数值特征，类别转为0/1/2并放在末列。Iris采用iris.data版本，没有另外应用官方页面所述历史勘误。Seeds仅规范空白分隔符及标签；没有缺失行被删除。

下载地址、原始压缩包与规范CSV的SHA-256、处理描述在manifest.json。可运行scripts/fetch_classification.py重新下载快照；运行应用使用仓库内CSV，不需要联网取数据。加载时验证哈希及有限值。

模型只使用图中两个特征。这是二维教学实验，不代表全特征模型的性能上限。相同二维特征分组留在同一划分，分层分组五折近似形成60/20/20训练池、验证、测试。只在训练集拟合标准化，公开样本只读，独立测试不展示。
