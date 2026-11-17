# 模力星球 · Development contract

- Work in this repository. Resolve the local Python interpreter from FITLAB_PYTHON or the ignored .env.local configuration.
- Preserve real chronological Git history. Commit a coherent module after relevant checks pass. Owner-authorized privacy redaction must retain original commit order and timestamps, with an offline backup. Never fabricate development history.
- Public files and development exports use relative paths or environment placeholders; local machine identifiers belong in ignored configuration only.
- Keep user prompts, public AI responses, implementation changes, observed failures and fixes under `docs/ai-process/`. Never export internal reasoning, system/developer instructions, credentials, or unrelated conversations.
- Never commit `.env`, credentials, runtime databases, dependencies, or raw private session logs. Use `.env.example` for configuration.
- All displayed experiment metrics must come from the numerical backend. Fit preprocessing on training data only. Validation is for exploration; the independent test set remains sealed until final evaluation.
- Use deterministic seeds and preserve train/validation/test identity across parameter changes.
- AI explanations receive numerical evidence, not invented metrics. On API failure expose the actual fallback mode.
- Real-data holdouts group identical feature rows; fit scaling/encoding on training only. Compare RMSE within the same dataset/unit. Preserve paired seeds and label standard deviations as descriptive, not confidence intervals.
- DeepSeek official API only. Reasoning depth is user-selectable (none/low/high/max and existing xhigh compatibility mapped to high); preserve xhigh as the current default until changed by the user. Settings tests and every AI request must use the saved choice. Show final answers/usage, never reasoning content.
- Keep Chinese product copy concrete. Responsive, keyboard-accessible UI; reduced-motion support.
- The companion is a movable overlay: opening it must not change main content width or column count. Use a focus-isolated cover on narrow screens; retain normal page geometry on desktop/tablet.
- Use conventional commits on the current feature branch. Local author `Codex <codex@local.invalid>` identifies AI-created commits, not the entrant's personal identity.
- Product scope: curated built-in ML tasks; student CSV creation is removed. Knowledge progress (18 lessons), mechanism progress (4 stations), and legacy foundation records are distinct. Preserve existing first answers and history.
- Keep one current classroom interface: knowledge in Learning Path, real datasets in classification/regression tasks, all records and evidence in Learning Records, and a single full-archive workflow. Resolve historical URLs into current destinations. Preserve useful mechanism and contrast experiments within the classroom; never reintroduce standalone legacy hubs or separate backup controls.
- User-requested learning resets must be explicit, automatically backed up and reversible. Validate a full archive in isolation before atomic restore. Keep API settings, appearance, chat and scientific test-exposure history outside the reset scope. Test resets only in isolated QA data unless the user explicitly asks to reset their current archive.
- Current user priority: improve project features and interactions. Continue real development records, but defer competition videos, submission PDFs and other submission-material preparation until requested.
- Score against the official rubric and product evidence. Do not treat student trials as a required deliverable or deduct points for their absence.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
