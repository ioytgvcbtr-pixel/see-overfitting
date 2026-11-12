# 看见过拟合 · 实验报告

时间：2026-11-12T22:33:36+08:00

## 参数与方法

```json
{
  "scene": "complexity",
  "degree": 4,
  "samples": 12,
  "noise": 0.22,
  "alpha": 1e-08,
  "seed": 42
}
```

PolynomialFeatures → StandardScaler → Ridge (SVD); preprocessing fitted on training only

## 真实指标

train_mse: 0.02130991

validation_mse: 0.06818481

gap: 0.04687490

数据指纹：e1816a59aff3f593

训练/验证/测试：12/80/120，使用独立随机流。

## 独立测试

尚未揭示独立测试结果。

## 解释

模式：none

当前训练与验证表现相对接近。继续比较相邻参数，避免仅凭一次结果下结论。

## 记录对比

未选择对比记录。

## 来源

合成数据 cos(1.5πx) + Gaussian noise; https://scikit-learn.org/stable/auto_examples/model_selection/plot_underfitting_overfitting.html
