# 本地验收记录 · 2026-11-12

项目版本0.1。Python实际解释器：<PYTHON_ENV>\python.exe（3.13.15）；Node24.14.1；Next16.4.6；React19.3.1。数值依赖版本见requirements.txt。

## 自动检查

| 检查 | 命令 | 实际结果 |
|---|---|---|
| 数值/API | `<PYTHON_ENV>\python.exe -m pytest tests -q` | 7 passed，约1.7秒 |
| 类型 | `npm.cmd run typecheck` | 通过 |
| 生产构建 | `npm.cmd run build` | 通过，主页面静态预渲染，API请求经同源转发到Python |
| Git差异 | `git diff --check` | 通过 |

一键启动脚本实际运行成功：Web首页、/health、经Web转发的/experiments/run均返回200，AI配置状态为true。终止该启动会话后，3000/8000监听及脚本启动的后端进程均退出。

7项测试覆盖：清空缓存后的数值复现与稳定验证池；数据集独立及测试指标隔离；复杂度扫描按验证误差选择；参数校验、SQLite档案和无API降级；JSON/Markdown附件与测试封存；仅在训练集拟合标准化；供应商401时明确降级且不回显凭据。

当前FastAPI/Starlette TestClient对httpx产生1条弃用警告，测试通过。本次未为消除提示而变更用户已有Python环境。

## 浏览器实际操作

Chrome工作台：

- 固定12个训练样本、σ=0.22、α=1e-8、seed42，对比4阶与15阶。训练MSE分别约0.0213/0.0061，验证MSE约0.0682/0.1538。
- 保存两份明确标记“浏览器验收记录”的实验，档案展示正确；选中两份后对比表与原始记录一致；载入会重新计算。
- 完成预测与一题独立迁移练习，浏览器进度由0/3变为1/3；刷新后保持。
- 复杂度扫描1—15阶，当前示例验证误差最低为4阶。
- 点击最终评估后显示独立测试MSE约0.0760，随后改参/切场景清空旧测试和解释。
- DeepSeek官方/models鉴权成功，返回deepseek-flash、deepseek-v4-pro；/coach真实请求返回online、deepseek-flash，浏览器显示“Flash在线”，解释引用当前实验指标。
- 报告弹窗生成快照成功，标准GET附件接口返回200，Content-Disposition、JSON字段与Markdown内容经HTTP检查；样例保存在artifacts/sample-report.json及.md。当前Chrome客户端策略拦截了附件导航（ERR_BLOCKED_BY_CLIENT），因此没有把浏览器文件保存标为通过。已补充无附件导航的在线预览与复制：浏览器成功读取34206字符JSON，包含指纹、完整数据及封存测试状态；点击复制入口。标准下载链接保留给浏览器允许时使用。

窄屏核验：public/qa-mobile.html使用390px宽独立iframe浏览上下文（扣除滚动条后document.clientWidth与scrollWidth均为375px），无横向溢出。实际展开导航、切到样本场景、用键盘End将训练样本调到160，指标正常更新。属于浏览器响应式核验，不是实体手机测试。

截图：artifacts/screenshots/desktop.jpg、mobile.jpg。全页CDP截图曾超时，交付截图采用可用的原生可视区域捕获；不伪造画面。

## 修复与文档复核

首次构建的空白CSS导入错误已修复。报告下载从Blob方式改为可检验的标准HTTP附件。图表对超出纵轴的预测/样本给出裁切提示；档案载入创建新参数对象并清除旧预测；报告生成期间禁用重复操作。

后续依据浏览器实际策略增加报告在线预览与复制，避免报告获取依赖下载权限。Next配置热更新重启期间捕获过一次旧RSC请求失败，页面重新载入后正常；不是数值服务故障。

独立文档读者复核发现的启动说明、状态区分、噪声边界和最终测试归属问题均已补充，并再次核对通过。

## 验证边界

本机可运行和真实API接入已验证；干净环境的完整10分钟复现、实体手机、目标用户学习效果和正式比赛视频/PDF尚未完成。所有过程证据来自真实操作，后续材料依照COMPETITION_CHECKLIST.md继续补充。
