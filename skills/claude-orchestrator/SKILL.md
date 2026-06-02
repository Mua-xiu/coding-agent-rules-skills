---
name: claude-orchestrator
description: Explicit-command skill for Codex to delegate bounded local coding work to Claude Code with fixed profile roles for architect, implementer, and mechanic, run Claude CLI with standalone profile settings, check profile availability and health, fall back to Codex when profiles are missing or unhealthy, require bounded validation, and have Codex review real artifacts before accepting. Use only when the user explicitly invokes this skill, asks Codex to delegate to Claude Code, or requests Claude account/profile orchestration; do not invoke for ordinary coding tasks by default.
---

# Claude Orchestrator

此 skill 用于让 Codex 主导 Claude Code 协作：Codex 判断本次任务是否值得委派，按固定职责选择 `architect`、`implementer` 或 `mechanic`，使用对应 profile 的独立 settings 启动 Claude 完成边界明确的子任务，最后由 Codex 审查真实产物。

## 触发方式

优先用显式命令触发，例如 `/claude-orchestrator <任务描述>` 或 `$claude-orchestrator <任务描述>`。只有用户明确要求“让 Claude Code 协作/委派/切号执行”时，才可自然语言触发。

不要因为普通开发需求自动调用 Claude。调用 Claude 会消耗外部模型额度，并可能修改文件。

## Claude Code 版本兼容说明

当前脚本和命令仅在 `2.1.146 (Claude Code)` 下完成验证。更高或更低版本的兼容说明和自行调整建议见 `references/usage.md` 与 `references/profile-management.md`。

## 工作流程

1. 每次触发本 skill 时，只根据本次用户请求和当前仓库状态重新判断任务，不沿用上一次 Claude 协作记录中的 profile、任务或 prompt。
2. 判断任务是否值得委派；简单直接改动、账号不可用或调用成本高于收益时，由 Codex 自己完成。
3. 按本次任务的风险、复杂度和交付物选择目标 profile。
4. 先运行 `scripts/switch-api.js --ping <profile>` 确认目标 profile 可用；普通 ping 会复用 TTL 内 `status=ok`，过期会重新探测。
5. ping 通过后，才使用 `scripts/switch-api.js --settings-path <profile>` 获取独立 settings 路径。
6. 使用 `claude --settings <profile-settings> --setting-sources project,local` 启动 Claude，发送边界明确的子任务。
7. Codex 检查真实 diff、验证结果、修改范围和用户目标，不把 Claude 自述当作验收依据。
8. 不合格时最多委派一次更具体的返工任务；仍不合格则停止委派并由 Codex 本地接管。

## 账号分工

profile 名称按任务职责命名，而不是按具体模型或账号命名。用户可以把 Claude、Gemini、DeepSeek、Mimo 或其他 provider 账号保存到对应职责名下。

- `architect`：主职是需求澄清、方案设计、任务拆解、前置风险识别。可辅助做只读风险/安全/认证/数据审查，以及 Codex 验收前的可选 diff 初审；任何情况下都不替代 Codex 最终验收。默认不承担直接交付大量代码的主实现；只有任务边界很小且 Codex 判断确有必要时，才可做单文件/单函数级 PoC，并遵守强制自验证。
- `implementer`：主职是边界明确后的功能实现、代码清理、测试补齐、文档补充和结构化跟进。必须严格遵守 `Only change` / `Do not change`；发现边界外问题时只在交付物中附记，不直接修改。
- `mechanic`：只处理同时满足三条标准的机械任务：不依赖语义判断决定怎么改、错误容易通过 diff/grep/运行发现、有客观对错标准。适合明确映射的替换、格式化、模板填充和跨文件同步；不适合自动生成内容、开放式整理或需要判断“怎么改”的任务。

如果任务不适合任何 Claude profile，或者目标 profile 不可用，Codex 应自己完成。

## Profile 可用性与兜底

- 没有任何可用 profile 时，提示用户按 `references/usage.md` 和 `references/profile-management.md` 配置账号；如果用户没有立即配置或当前任务仍需继续，Codex 直接兜底完成本次任务，不反复追问。
- 目标职责 profile 不存在或缺少 `settings.json` 时，不临时改派给其它职责 profile；Codex 直接接管该子任务，并在最终回复中简短说明原因。
- 目标 profile 的健康状态缺失、为 `down` 或实际调用失败时，最多确认两次：先运行 `--ping <profile>`，仍失败或调用失败时再运行 `--ping <profile> --force`。两次后仍失败，则停止委派并由 Codex 接管该子任务。
- 除非用户明确要求重新绑定 profile 或临时改用某个账号，否则 `architect`、`implementer`、`mechanic` 之间不互相顶替。

## 独立调用账号

已安装到 Codex 后，推荐先定义通用路径：

```powershell
$CodexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME ".codex" }
$SkillDir = Join-Path $CodexHome "skills\claude-orchestrator"
```

默认模式只输出 profile settings 路径，不覆盖 `~/.claude/settings.json`：

```powershell
node "$SkillDir\scripts\switch-api.js" --ping implementer
$SettingsPath = node "$SkillDir\scripts\switch-api.js" --settings-path implementer
claude --settings "$SettingsPath" --setting-sources project,local
```

委派前必须先执行 `--ping <profile>`，不能只取 `--settings-path` 后直接调用 Claude。健康探测会复用 TTL 内的 `status=ok`；`--force` 和 `--refresh-health` 才强制重测：

```powershell
node "$SkillDir\scripts\switch-api.js" --ping implementer
node "$SkillDir\scripts\switch-api.js" --ping implementer --force
node "$SkillDir\scripts\switch-api.js" --refresh-health
```

`--setting-sources project,local` 用于排除当前全局 user settings，避免 `~/.claude/settings.json` 污染独立 profile 调用。只有独立调用无法承载特定账号/provider 配置时，才可显式使用旧版回退命令：`node "$SkillDir\scripts\switch-api.js" implementer --mode global-overwrite`。

## 工具策略

工具策略按任务类型选择，不把 `--tools ""` 和 `--allowedTools ""` 当作同义写法。Claude Code 2.1.146 中，`--tools` 控制可用工具集合；`--allowedTools` 是允许调用列表。

| 任务类型 | 工具策略 | Prompt 首句要求 |
| --- | --- | --- |
| 纯文本任务：上下文已完整注入的计划、互评、文本总结 | `--tools ""` | 不要调用工具、不要读取目录、直接输出文本结果。 |
| 仓库感知规划/拆解：需要理解目录、模块或 diff，但不改文件 | `--tools Read,Glob,Grep` + `--allowedTools Read,Glob,Grep` + `--effort low` | 只读分析，不要修改任何文件。 |
| 仓库内只读审查：diff 初审、风险审查、代码走读 | `--tools Read,Glob,Grep` + `--allowedTools Read,Glob,Grep` + `--effort low` | 只读分析，不要修改任何文件。 |
| 代码修改任务：功能实现、测试补齐、机械替换 | 按任务开放最小必要工具，并允许执行验证命令 | 写明 `Only change`、`Do not change` 和验证命令。 |

目标文件或参考资料位于工作目录外时，Claude 命令必须为每个外部目录显式添加 `--add-dir <path>`，避免 `dontAsk` 模式卡在跨目录授权。通过 Codex shell 调用 Claude 时，将命令等待时间设为至少 180 秒；仍超时则缩小 prompt 范围或拆分任务。

## 复杂任务串行委派

任务同时需要前置方案设计和直接交付代码/文档时，优先拆成串行步骤：

1. `architect` 只读或纯文本出方案：实现路径、关键模块、风险点、验证方式。
2. Codex 审方案：判断是否符合用户目标、是否越界、是否漏掉关键风险。不合格时最多要求修订一次，仍不合格则 Codex 接管设计。
3. `implementer` 按方案实现：prompt 中引用方案要点，明确 `Only change`、`Do not change` 和 `Run`。
4. Codex 验收：检查 diff、运行验证命令；必要时让 `architect` 做只读 diff 初审，但最终接受/拒绝由 Codex 决定。

简单任务（单文件改动、明确机械替换、独立小功能）不走该流程，仍按单次委派处理。

## 代码类委派强制自验证

任何会产生代码改动的委派，prompt 中必须包含：

- 明确验证命令。优先使用项目已有测试/构建/lint/运行入口；没有现成命令时，优先用不落盘的一次性命令（如 `python -c`、`node -e`）。需要新增持久化测试/脚本文件时，必须把该文件写入 `Only change`，否则先询问用户。
- 真实验证结果。Claude 必须返回命令、退出码、关键 stdout/stderr 片段；不接受“已验证”“应该可以”等无证据描述。
- 断言或客观校验。行为改动至少给一个正常场景断言和一个边界场景断言；格式化、机械替换或文档整理可改用 diff、grep、lint、快照对比等客观校验。
- 验证未通过不算交付。Codex 决定是否给一次更具体的返工请求；第二次仍失败则本地接管。
- 越界改动默认拒绝。验证命令或 Claude 操作意外改动边界外文件时，Codex 默认拒绝或清理；只有确认确有必要且用户同意后才接受。

`Validation performed` 字段为必填，必须包含命令、退出码、关键输出、断言/客观校验对照。

## Handoff 规则

纯文本任务、只读任务和普通代码任务默认在 stdout 返回结构化 handoff，不写工作区文件。结构化 handoff 至少包含：

- 任务目标
- 已完成内容
- 修改文件或分析范围
- 已运行测试和结果
- 未解决问题
- 下一步建议

只有续作、切换 profile、中断恢复或用户明确要求留档时，才写工作区 handoff 文件。若要写入 `docs/claude-handoff-<topic>.md` 或其它文件，路径必须纳入 `Only change`；原任务未允许新增文档时，先询问用户或改用 stdout。

## 验收规则

Codex 只能在检查真实产物后接受 Claude 的工作。优先使用最窄但可靠的验证方式：

- 检查 changed files 的 diff。
- 运行目标测试或验证命令。
- 如果任务影响运行路径，运行实际 CLI 或关键流程。
- 如果任务涉及数据、认证、安全或删除，额外检查越权、回滚和数据风险。

以下情况必须拒绝：只完成了部分请求范围、删除代码但没有证明路径已经废弃、非平凡行为变化缺少测试或验证、Claude 报告与真实仓库状态不一致、修改范围越界。

## Prompt 模板

```text
You are working in <workspace>.
<Pure text / Read-only / Code change instruction first sentence.>

Task:
<bounded objective>

Constraints:
- Only change: <files or modules>
- Do not change: <protected files or behavior>
- Run: <tests or commands>

Acceptance assertions / objective checks:
- <normal case or objective check>
- <edge case or objective check>

Return:
- Summary of changes
- Files changed
- Validation performed: command, exit code, key output, assertion/check result
- Remaining issues
- Handoff: task goal, completed work, unresolved issues, next step
```

## 最终反馈补充

使用此 skill 后，Codex 最终回复仍应包含正常交付反馈：完成内容、改动摘要、验证结果和剩余风险。除此之外，追加简短的 Claude 调度说明：

```text
Claude 协作记录：
- architect：负责 xxx 方案/只读审查。
- implementer：负责 xxx 实现或测试。
- mechanic：负责 xxx 机械整理。
```

如果没有实际调用 Claude，则写：

```text
Claude 协作记录：未使用，本次由 Codex 直接完成。
```

如果因 profile 缺失或失活而由 Codex 兜底，简短说明原因和接管范围；不要粘贴 token、完整 settings 路径、完整日志或冗长过程。后续再次调用本 skill 时，不得把上一轮最终回复中的“Claude 协作记录”当作默认角色分配或任务安排。

## 安全规则

- 不把 Claude token、provider token、profile 快照提交到仓库。
- 不默认读取 Claude 完整过程输出；验收以真实 diff 和验证命令为准。
- 默认使用独立 profile settings，不覆盖本机全局配置。
- 只有显式使用 `--mode global-overwrite` 回退时，才覆盖全局配置；覆盖前保留备份，除非用户明确关闭。
- 失败或风险较高时再读取详细日志，平时只读摘要和必要错误片段。

更完整的使用说明见 `references/usage.md`；账号/profile 文件维护见 `references/profile-management.md`。
