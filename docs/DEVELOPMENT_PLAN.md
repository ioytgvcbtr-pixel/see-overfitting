# 开发计划与里程碑

Python：<PYTHON_ENV>\python.exe。项目：<PROJECT_ROOT>。所有时间使用北京时间。

## 执行顺序

| 阶段 | 交付与验收 | 计划提交 |
|---|---|---|
| M0 设计与留痕 | 功能设计、开发计划、忽略规则、真实会话导出工具 | docs: define product and evidence plan |
| M1 环境 | 核对指定解释器、前端依赖锁、后端需求清单、启动脚本 | chore: bootstrap development environment |
| M2 数值核心 | 确定性数据划分、训练/验证、复杂度扫描、独立测试；数值测试 | feat: implement reproducible experiments |
| M3 工作台 | 精修布局、SVG拟合图、参数、场景、预测与练习；类型检查 | feat: build interactive learning studio |
| M4 产品闭环 | SQLite记录、比较、载入、报告、学习进度 | feat: add experiment history and reports |
| M5 AI | Flash服务接入、基于真实指标的解释、错误模式、真实联调 | feat: connect evidence-grounded coach |
| M6 验收 | 生产构建、API测试、桌面/移动浏览器流程、修正与截图 | fix: refine verified user flows |
| M7 交付 | 复现指南、测试报告、比赛材料清单、过程证据索引 | docs: publish reproducible local release |

## 比赛剩余日程

11月12—13日：搭建并实现上述可运行主流程。
11月14—15日：参赛者试用，按实际反馈迭代，记录真实Prompt与修复。
11月16日：功能冻结、问题修复、完整新环境复现。
11月17日：技术文档定稿、录制视频，审核公开仓库与材料。
11月18日上午：完成最终提交；官方截止15:00。

## 当前执行原则

先完成三个聚焦实验，不扩展通用机器学习平台。保留每次真实失败及修正，禁止伪造测试分数、对话、提交时间、用户反馈。计划工时是估算，不写入实际完成记录。

## 验收记录

实际完成情况、命令、结果见docs/VALIDATION.md；每个阶段的意图、实现、反馈见docs/ai-process/。当前聊天原始公开消息经脱敏导出，内部推理和系统指令不进入交付。
