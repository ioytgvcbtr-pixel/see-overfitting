# 看见过拟合 · FitLab

交互式机器学习实验与诊断工作台。用真实计算理解模型复杂度、样本量、噪声与正则化，通过预测、实验、解释和练习形成学习闭环。

- [功能设计](docs/FUNCTIONAL_DESIGN.md)
- [开发计划](docs/DEVELOPMENT_PLAN.md)
- [AI开发记录](docs/ai-process/README.md)

当前为本地可运行的0.1版：三个实验、复杂度扫描、预测与迁移练习、记录回放与对比、独立测试、报告导出和DeepSeek Flash教练已实现。实际核验范围见[验收记录](docs/VALIDATION.md)。比赛视频、正式技术PDF和目标用户试用仍待参赛者完成。

## 本机启动

Python固定使用`<PYTHON_ENV>\python.exe`。进入项目后，在PowerShell运行：

```powershell
cd '<PROJECT_ROOT>'
.\scripts\start.ps1
```

打开 http://127.0.0.1:3000 。关闭运行终端或Ctrl+C停止；脚本会同时关闭由它启动的后端。3000和8000端口需空闲。

## 首次安装与10分钟复现

```powershell
npm.cmd ci
& '<PYTHON_ENV>\python.exe' -m pip install -r requirements.txt
& '<PYTHON_ENV>\python.exe' scripts/check_environment.py
.\scripts\start.ps1
```

另一台电脑可先准备Python3.13，调整`scripts/start.ps1`中的解释器路径。当前已锁定本次验证使用的依赖；全新环境的10分钟目标仍需参赛前实测，网络下载时间取决于环境。

## AI配置

复制`backend/.env.example`为`backend/.env`并设置`AI_API_KEY`。配置项：

```dotenv
AI_BASE_URL=https://api.deepseek.com/v1
AI_MODEL=deepseek-flash
AI_API_KEY=填写你自己的密钥
AI_TIMEOUT=45
```

当前电脑的密钥已经保存于忽略的本地配置中。修改配置后重启后端。无API时实验、练习、记录照常运行，教练明确显示规则分析。接口故障也显示降级原因。密钥不进入前端、Git或导出报告。

## 验证

```powershell
& '<PYTHON_ENV>\python.exe' -m pytest tests -q
npm.cmd run typecheck
npm.cmd run build
```

测试依赖：`requirements-dev.txt`。数值来源为独立随机流生成的合成数据，预处理只在训练集拟合，验证集供调参，测试集在点击最终评估后才揭示。改变参数使旧测试结果和解释失效。改变噪声会用同一噪声抽样缩放三组标签，改变样本量则保持验证与测试数据不变。

运行数据保存在`data/fitlab.sqlite`，不随仓库发布。学习进度保存在当前浏览器。仓库中的截图与开发验收记录是开发证据，不是学生学习效果研究数据。

报告在弹窗中预览或复制，也可点击附件链接下载。当前Chrome策略会拦截自动化附件导航，已核验的可用获取方式是在线预览/复制；标准附件接口另经HTTP验证。示例报告在`artifacts/sample-report.json`和`.md`。

## 比赛与开发记录

- 真实公开会话与工具事件：`docs/ai-process/`。用`scripts/export_ai_process.py --session <当前会话jsonl>`更新；导出仅包含本项目开始后的公开信息，排除内部推理与凭据。
- Git提交使用仓库内的自动化作者`Codex <codex@local.invalid>`，清楚标识AI生成工作；未来参赛者自己的提交使用本人身份。
- 待完成材料与录屏脚本：[比赛交付清单](docs/COMPETITION_CHECKLIST.md)。本地尚未配置远程仓库，发布至GitHub/Gitee时另行建立评审访问方式。
