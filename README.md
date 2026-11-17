# 模力星球

机器学习交互式学习平台。

从一张数据表出发，自己清洗数据、选择模型、填写参数，在预测结果的变化中理解机器学习。课程、公开课例、概念场景和学习问答放在同一个网页中，学习者可以带着问题实验，再根据结果修正判断。

![平台首页](artifacts/screenshots/home.jpg)

## 学习内容

学习航线从机器学习基本概念、数据准备和模型家族出发，逐步介绍评价方法与大模型相关知识。每课配有解释、示意、小检查与进一步阅读。

分类与回归实训把数据体检、清洗、划分、模型参数、训练、对照和迁移连接起来。输入会参与实际计算，结果图形与数值由后端产生。模型图鉴帮助认识不同算法的判断方式。

机制工坊通过误差、复杂度、约束和边界场景组织滑块与拖拽互动。小模按需回答概念和实验问题，实验建议经确认后实际执行。我的学习记录保存课题、首次判断、配置与探索过程，支持导出、恢复、重置和撤销。

## 完成一堂实训

选择一个公开课例，了解目标和数据情况；填写处理与划分方案，选择模型并设置参数。训练前留下预期，训练后查看验证读数与错误样本，再定格A、修改条件训练B。需要解释时可以询问小模，也可以进入相应机制场景继续观察。

## 技术与数据

网页使用React与Next.js组织交互，以Canvas、SVG和HTML表达图形与控件。FastAPI承载本机数值服务，NumPy、SciPy及scikit-learn完成计算，SQLite保存学习与实验记录。DeepSeek官方接口用于问答和实验建议，核心数值实验可独立运行。

公开课例和来源说明随data目录提供；界面素材随public目录提供。不同类型的数据与生成条件分别标注。

## 本机运行

准备Python 3.13、Node.js 24（含npm）与PowerShell 7。在本目录执行：

```powershell
python -m venv .venv
$env:FITLAB_PYTHON = (Resolve-Path './.venv/Scripts/python.exe').Path
./scripts/start.ps1 -Install
```

浏览器访问 http://127.0.0.1:3000 。保持终端打开，Ctrl+C退出本次服务。

生产运行可在安装成功后执行npm run build，再运行scripts/start.ps1 -Production。端口占用时，可通过-WebPort与-ApiPort指定其他端口。

DeepSeek在网页设置中使用个人密钥。没有密钥或服务不可用时，界面说明当前采用本地规则提示，数值实验仍可进行。环境示例见.env.example与backend/.env.example，依赖清单见requirements.txt、package.json和package-lock.json。

## 开发与说明

- [数据说明](data/README.md)
- [界面素材](public/illustrations/README.md)
- [开发过程](docs/ai-process/README.md)
- [软件验证](docs/VALIDATION.md)

开发检查包括Python测试、前端逻辑、类型、生产构建和浏览器操作，相关脚本与工作流随工程提供。
