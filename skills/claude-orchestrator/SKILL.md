---
name: claude-orchestrator
description: Explicit-command skill for Codex to delegate bounded local coding work to Claude Code with fixed profile selection rules for architect, implementer, and mechanic, switch the local Claude/provider profile when needed, require handoff discipline, and have Codex review real artifacts before accepting. Use only when the user explicitly invokes this skill, asks Codex to delegate to Claude Code, or requests Claude account/profile orchestration; do not invoke for ordinary coding tasks by default.
---

# Claude Orchestrator

此 skill 用于让 Codex 主导 Claude Code 协作：用户在 Codex 中提出任务，Codex 判断是否适合委派，按固定账号分工选择 `architect`、`implementer` 或 `mechanic`，切换 Claude profile 后让 Claude 完成边界明确的子任务，最后由 Codex 审查真实产物。

## 触发方式

优先用显式命令触发，例如 `/claude-orchestrator <任务描述>` 或 `$claude-orchestrator <任务描述>`。只有用户明确要求“让 Claude Code 协作/委派/切号执行”时，才可自然语言触发。

不要因为普通开发需求自动调用 Claude。调用 Claude 会切换本机账号/profile、消耗外部模型额度，并可能修改文件。

## 工作流程

1. 每次触发本 skill 时，先只根据本次用户请求和当前仓库状态重新判断任务，不沿用上一次 Claude 协作记录中的 profile、任务或 prompt。
2. 判断任务是否适合委派：适合审查、批量修改、文档、测试补齐、中高复杂度实现；简单直接改动由 Codex 自己完成。
3. 按本次任务的实际风险、复杂度和交付物重新选择 Claude profile，而不是动态询问用户配置角色，也不是复用上一次选择。
4. 使用 `scripts/switch-api.js` 切换到目标 profile。
5. 启动 `claude`，发送边界明确的任务，并要求 Claude 返回结构化 handoff。
6. Codex 检查真实 diff、测试结果、修改范围和用户目标，不把 Claude 自述当作验收依据。
7. 不合格时最多委派一次更具体的返工任务；仍不合格则 Codex 停止委派并本地接管。

## 账号分工

profile 名称按任务职责命名，而不是按具体模型或账号命名。这样做是为了让 Codex 根据“任务需要什么能力”稳定选择 profile；用户可以把 Claude、Gemini、DeepSeek、Mimo 或其他 provider 账号保存到对应职责名下。

- 使用 `architect` 处理高判断成本任务：架构审查、风险删除、图/Schema 变更、大范围重构、安全/认证/数据风险审查，以及判断错误代价较高的任务。建议绑定推理、架构判断和风险识别能力最强的账号。
- 使用 `implementer` 处理中等复杂度执行任务：明确边界后的功能实现、代码清理、测试补齐、文档补充和结构化跟进工作。建议绑定执行稳定、成本适中、适合持续改代码的账号。
- 使用 `mechanic` 处理低风险机械任务：格式化类修改、模板更新、简单文件移动、重复文本清理和低风险批量整理。建议绑定成本低、速度快、适合重复整理的账号。

如果任务不适合任何 Claude profile，或者调用 Claude 的成本高于直接处理，Codex 应自己完成。

## 切换账号

已安装到 Codex 后，推荐先定义通用路径：

```powershell
$CodexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME ".codex" }
$SkillDir = Join-Path $CodexHome "skills\claude-orchestrator"
```

切换命令：

```powershell
node "$SkillDir\scripts\switch-api.js" architect
node "$SkillDir\scripts\switch-api.js" implementer
node "$SkillDir\scripts\switch-api.js" mechanic
```

启动 Claude：

```powershell
claude
```

## 委派规则

- 每次委派前必须重新写出本次 Claude 子任务；不得直接复用历史会话中的 Claude 角色分配、旧 prompt 或最终反馈里的“Claude 协作记录”。
- 只有用户明确要求继续同一个未完成任务，或当前任务本身依赖上一轮 Claude handoff 时，才读取并引用旧 handoff；引用前仍要重新判断本次 profile 和任务边界。
- 给 Claude 一个有边界的任务和明确交付物。
- 写清工作目录、目标文件、允许修改的范围和禁止修改的范围。
- 目标文件或参考资料位于工作目录外时，Claude 命令必须为每个外部目录显式添加 `--add-dir <path>`，避免 `dontAsk` 模式卡在跨目录授权。
- 优先把 Claude 委派拆成小任务；只读分析、资料收集和排障类任务优先使用 `--effort low`，并限制 `--allowedTools Read,Glob,Grep`。
- 通过命令行调用 Claude 时，将 Codex 的命令等待时间设为至少 180 秒；如果仍超时，缩小 prompt 范围或拆分任务后再试一次。
- 写清需要运行的验证命令；如果不能运行，要求 Claude 说明原因。
- 要求 Claude 返回：完成内容、改动文件、验证命令和结果、剩余风险或阻塞。
- 每个 Claude 会话优先只处理一个子任务，除非多个任务强相关。
- 不依赖 Claude 重启后的会话记忆；切换 profile 或重启前必须要求 handoff。

## Handoff 规则

切换 profile、重启 Claude 或结束 Claude 会话前，要求 Claude 在工作区留下 handoff 说明，内容包括：

- 任务目标
- 已完成内容
- 修改文件
- 已运行测试和结果
- 未解决问题
- 下一步建议

如果项目没有更合适的位置，使用：

```text
docs/claude-handoff-<topic>.md
```

只有继续同一个未完成任务时，下一次 Claude 会话才以该 handoff 作为起点；新任务或新一次独立调用不得把旧 handoff 当成默认任务来源。

## 验收规则

Codex 只能在检查真实产物后接受 Claude 的工作。优先使用最窄但可靠的验证方式：

- 检查 changed files 的 diff。
- 运行目标测试或验证命令。
- 如果任务影响运行路径，运行实际 CLI 或关键流程。
- 如果任务涉及数据、认证、安全或删除，额外检查越权、回滚和数据风险。

以下情况必须拒绝：

- 只完成了部分请求范围。
- 删除代码但没有证明路径已经废弃。
- 非平凡行为变化缺少测试或验证。
- Claude 报告与真实仓库状态不一致。
- 修改范围越界。

一次失败后，可以给 Claude 一次更具体的返工请求；第二次仍失败时，停止委派并由 Codex 本地完成。

## Prompt 模板

```text
You are working in <workspace>.

Task:
<bounded objective>

Constraints:
- Only change: <files or modules>
- Do not change: <protected files or behavior>
- Run: <tests or commands>

Return:
- Summary of changes
- Files changed
- Validation performed
- Remaining issues
```

## 最终反馈补充

使用此 skill 后，Codex 最终回复仍应包含正常交付反馈：完成内容、改动摘要、验证结果和剩余风险。除此之外，追加简短的 Claude 调度说明：

```text
Claude 协作记录：
- architect：负责 xxx 高风险审查。
- implementer：负责 xxx 实现或测试。
- mechanic：负责 xxx 机械整理。
```

如果没有实际调用 Claude，则写：

```text
Claude 协作记录：未使用，本次由 Codex 直接完成。
```

该说明只记录调度分工，不替代 Codex 对最终结果的审查结论；不要粘贴 token、完整日志或冗长过程。
后续再次调用本 skill 时，不得把上一轮最终回复中的“Claude 协作记录”当作默认角色分配或任务安排。

## 安全规则

- 不把 Claude token、provider token、profile 快照提交到仓库。
- 不默认读取 Claude 完整过程输出；验收以真实 diff 和验证命令为准。
- 切 profile 前保留本机配置备份，除非用户明确关闭。
- 失败或风险较高时再读取详细日志，平时只读摘要和必要错误片段。

更完整的使用说明见 `references/usage.md`；账号/profile 文件维护见 `references/profile-management.md`。
