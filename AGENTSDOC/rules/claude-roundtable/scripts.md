# claude-roundtable 脚本模块规则

当任务修改 `skills/claude-roundtable/scripts/roundtable.js`、`scripts/roundtable-lib/`、讨论记录格式、参与者筛选、模型间定向消息路由或 Claude 调用参数时，必须先读取本文件。

## 目录职责

- `scripts/roundtable.js`：CLI 薄入口，只负责解析后的调度入口和错误兜底。
- `scripts/switch-api.js`：共享 profile 脚本从版本，必须与 `claude-orchestrator` 主版本保持一致。
- `scripts/lib/`：共享 profile 脚本模块从版本，必须与 `claude-orchestrator/scripts/lib/` 保持一致，不放 roundtable 专属逻辑。
- `scripts/roundtable-lib/args.js`：roundtable 专属参数解析、帮助文本、默认值、只读工具白名单和 `--read-scope` 约束。
- `scripts/roundtable-lib/participants.js`：从 `~/.claude/profiles/` 选择参与者，通过共享 `pingProfile()` 做 TTL 感知测活，解析 settings 路径，并维护候补参与者。
- `scripts/roundtable-lib/claude-runner.js`：Claude CLI 调用参数拼装、session 管理、超时、无效工具标签响应检测和失败包装。
- `scripts/roundtable-lib/orchestrator.js`：结构化讨论阶段、失败容忍、首轮候补补位、降级状态和定向消息上限控制。
- `scripts/roundtable-lib/transcript.js`：`state.json`、`messages.jsonl`、`interactive-transcript.md` 和 `failures.json` 写入。
- `scripts/roundtable-lib/prompts.js`：首轮、互评、修正和定向消息 prompt 模板。
- `scripts/roundtable-lib/directed-messages.js`：解析和校验 `question`、`challenge`、`answer`、`support` 定向消息。
- `scripts/roundtable-lib/redact.js`：transcript、state 和错误输出中的敏感字段脱敏。

## 维护纪律

- 保持 `roundtable.js` 为薄入口；新增讨论逻辑优先放入职责匹配的 `scripts/roundtable-lib/*.js`。
- 不要把 roundtable 专属逻辑放入 `scripts/lib/`，该目录只用于同步 `claude-orchestrator` 的共享 profile 脚本模块。
- `SKILL.md`、`references/usage.md` 和 `references/profile-management.md` 必须能支持用户单独安装 `claude-roundtable`；不能要求用户去 `claude-orchestrator` 文档中补齐账号配置、测活或命令说明。
- 默认 Claude 调用必须使用 `--settings <profile-settings> --setting-sources project,local`，不读取或覆盖全局 user settings。
- 默认纯文本讨论禁用 Claude 工具：`--tools ""`。模型不得输出 `<tool_call>` / `<tool_calls>`，不得声称读取本地文件。
- 仓库事实讨论必须使用 `--read-scope` 进入受限只读模式；只允许 `Read,Glob,Grep`，并自动配套 `--allowedTools`。不得开放 `Edit`、`Write`、`Bash` 或其它修改/执行能力。
- `--read-scope` 是讨论读取边界说明，不是系统级沙箱；prompt 必须限制模型只读主题相关范围，Codex 最终裁决时仍要复核是否越界或过度扫描。
- 参与者选择必须调用共享 `pingProfile()`，不能只读取 `health.json.status`；`status=ok` 超过 5 小时 TTL 时必须重新 ping。
- `--max-participants` 只表示当前参与者上限；首轮失败时应从已通过测活的候补 profile 补位。健康探测后可参与账号少于 2 个，或首轮结束后有效参与者少于 2 个时，必须中断，不得继续做单账号互评/修订；`state.status` 写为 `insufficient_participants`。
- Codex 必须在运行前形成自身预分析，并通过 `--codex-brief` 或 `--codex-brief-file` 写入运行记录；该预分析不发送给参与模型，只作为 Codex 最终裁决和纠偏基线。
- 不使用 `api-profiles.json`，不生成临时 settings 文件，不使用 `global-overwrite`。
- `--max-directed-turns` 必须保留默认上限；调整默认值前要说明成本和死循环风险。
- 讨论记录默认写入当前工作目录的 `roundtable-runs/`，不要写入 `~/.claude/profiles/<profile>/`。
- 用户可见脚本输出继续遵守 `AGENTSDOC/rules/global/skill-script-i18n.md` 的中英双语规范。
- 修改仓库版 skill 后，如需在当前机器上实测，必须同步到 `~/.codex/skills/claude-roundtable`，并在反馈中说明是否已同步。

## 验证要求

- 至少运行 `node --check` 覆盖 `scripts/roundtable.js`、`scripts/roundtable-lib/*.js`、`scripts/switch-api.js` 和 `scripts/lib/*.js`。
- 至少验证 `scripts/switch-api.js --help`、`--list`、`--settings-path <profile>`，确认从版本仍可用。
- 至少运行一次 `scripts/roundtable.js --dry-run --profiles <两个profile>`，确认生成 `state.json`、`messages.jsonl` 和 `interactive-transcript.md`。
- 至少验证 `--codex-brief` 或 `--codex-brief-file` 会写入 state/transcript。
- 至少验证 `--read-scope` dry-run，确认 transcript/state 记录 discussion mode、tools 和 read scopes。
- 至少验证非法工具参数会被拒绝，例如 `--tools Edit --read-scope .`。
- 完整实现后，至少运行一次两个 profile 的真实讨论，确认首轮独立、互评和修正阶段均写入 transcript。
- 验证运行前后没有修改全局 `~/.claude/settings.json`。
- 检查 transcript 和 state 中不包含 token、api key、Bearer 等敏感值。
