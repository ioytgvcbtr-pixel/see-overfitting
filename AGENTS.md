# 看见过拟合 · Development contract

- Work in this repository. Python interpreter: `<PYTHON_ENV>\python.exe`.
- Preserve real chronological Git history. Commit a coherent module after its relevant checks pass. Do not rewrite or fabricate development history.
- Keep user prompts, public AI responses, implementation changes, observed failures and fixes under `docs/ai-process/`. Never export internal reasoning, system/developer instructions, credentials, or unrelated conversations.
- Never commit `.env`, credentials, runtime databases, dependencies, or raw private session logs. Use `.env.example` for configuration.
- All displayed experiment metrics must come from the numerical backend. Fit preprocessing on training data only. Validation is for exploration; the independent test set remains sealed until final evaluation.
- Use deterministic seeds and preserve train/validation/test identity across parameter changes.
- AI explanations receive numerical evidence, not invented metrics. On API failure expose the actual fallback mode.
- Keep Chinese product copy concrete. Responsive, keyboard-accessible UI; reduced-motion support.
- Use conventional commits on the current feature branch. Local author `Codex <codex@local.invalid>` identifies AI-created commits, not the entrant's personal identity.
