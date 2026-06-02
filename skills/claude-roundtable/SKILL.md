---
name: claude-roundtable
description: Run a Codex-moderated structured discussion across multiple local Claude Code profiles discovered from ~/.claude/profiles. Use when the user explicitly asks for multi-model or multi-account discussion, debate, critique, risk ranking, plan review, architecture tradeoff review, or a P0-P4 issue-ranked recommendation before implementation. The skill writes transcripts for Codex review and leaves final judgment, plan generation, and acceptance decisions to Codex.
---

# Claude Roundtable

此 skill 用于通过本机多个 Claude Code profile 进行受控讨论，然后由 Codex 做最终裁决。

它不是投票器。多个模型只负责暴露不同视角、风险、缺失信息和可执行路径；Codex 读取 transcript，必要时核验本地事实，最终统一判断 P0-P4 问题等级和用户下一步。

本 skill 可以单独安装和使用。虽然它与 `claude-orchestrator` 采用同一套 profile 存储协议，但本目录自带 `scripts/switch-api.js`、`scripts/lib/` 和完整 references；不要要求用户另行下载 `claude-orchestrator` 才能配置账号或理解用法。

## Claude Code 版本兼容说明

当前脚本和命令仅在 `2.1.146 (Claude Code)` 下完成验证。更高或更低版本的兼容说明、自行调整建议和完整命令示例见 `references/usage.md`。

## 核心流程

1. 先做 Codex 自身预分析：整理任务目标、边界、已知事实、关键风险、可能的 P0/P1 和需要模型重点挑战的假设。
2. 把用户请求整理成具体讨论主题，写清任务边界、已知约束和期望输出。
3. 判断讨论是否需要读取仓库事实：题面事实足够时使用纯文本模式；需要核对本地文件时使用受限只读模式并写清 `--read-scope`。
4. 运行 `scripts/roundtable.js`；必须带上 `--codex-brief` 或 `--codex-brief-file` 保存 Codex 预分析。除非用户明确指定参与者，否则至少选择两个可用 profile。
5. 如果可参与账号少于 2 个、全部缺失/失活，或首轮后有效参与者少于 2 个，停止 roundtable；告知用户当前不适合多账号讨论，改为用户与 Codex 直接讨论。
6. 读取生成的 `interactive-transcript.md`、`state.json`、`messages.jsonl`，以及存在时的 `failures.json`。
7. Codex 对照自己的预分析审查讨论结果，不用多数票代替验收。
8. 告知用户最终建议、关键依据、所有 P0-P4 问题、是否建议生成计划文档，以及需要确认的下一步。

## 运行讨论

在目标工作目录中运行：

```powershell
node <skill-dir>\scripts\roundtable.js `
  --codex-brief "Codex baseline: clarify scope, likely risks, and assumptions to challenge." `
  --topic "Should we implement the new cache layer now or split it into a separate plan?"
```

常用参数：

```powershell
node <skill-dir>\scripts\roundtable.js --topic-file .\topic.md --codex-brief-file .\codex-brief.md --profiles architect,implementer
node <skill-dir>\scripts\roundtable.js --topic "..." --codex-brief "Codex baseline: ..." --profiles all --max-participants 3
node <skill-dir>\scripts\roundtable.js --topic "..." --codex-brief "Codex baseline: ..." --max-directed-turns 6
node <skill-dir>\scripts\roundtable.js --topic "..." --dry-run
```

需要模型基于仓库事实讨论时，使用受限只读模式：

```powershell
node <skill-dir>\scripts\roundtable.js `
  --topic-file .\topic.md `
  --codex-brief-file .\codex-brief.md `
  --profiles all `
  --max-participants 2 `
  --read-scope .\src\views\HomeView.vue `
  --read-scope .\e2e\login.spec.ts
```

脚本默认行为：

- 从 `~/.claude/profiles/` 自动发现 profile。
- 通过共享健康探测校验 profile；`status=ok` 只在 5 小时 TTL 内复用，过期会重新 ping，失败则跳过并记录。
- `--max-participants` 是当前参与者上限；首轮参与者失败时，控制器会尝试启用候补 profile。
- 如果健康探测后可参与账号少于 2 个，或首轮结束后有效参与者少于 2 个，脚本会写入 `insufficient_participants` 并中断，不继续做单账号互评/修订。
- 通过共享 `switch-api.js` 使用每个 profile 的独立 settings。
- 调用 Claude 时固定使用 `--setting-sources project,local`，避免混入当前全局 user settings。
- 默认纯文本模式使用 `--tools ""`，参与者只能基于题面事实讨论，不能读取文件、输出 `<tool_call>` 或声称已检查仓库。
- 受限只读模式由 `--read-scope` 触发，只开放 `Read,Glob,Grep`，禁止 `Edit`、`Write`、`Bash` 和任何代码修改。
- 在当前工作目录的 `roundtable-runs/<timestamp>-<id>/` 下写入运行记录。

`--read-scope` 应只包含与讨论主题直接相关的文件或目录。它是模型读取边界说明，不是操作系统沙箱；Codex 必须在最终裁决时复核模型是否越界、是否过度扫描、是否把猜测当事实。读取工作目录外资料时，才配合 `--add-dir <path>`。

## 讨论阶段

脚本执行以下阶段：

1. 独立首轮回答：每个 profile 在看不到其他回答的情况下独立回答同一主题。
2. 互评与质疑：每个 profile 读取首轮回答，指出风险、弱证据和缺失假设。
3. 修正建议：每个 profile 基于互评修正自己的建议。
4. 可选定向路由：参与者可以发出 `question`、`challenge`、`answer`、`support` 类型的定向消息；控制器用 `--max-directed-turns` 截断。

脚本只生成供 Codex 审查的证据，不生成最终面向用户的裁决。

如果健康筛选后可用账号少于 2 个，或首轮结束后有效参与者少于 2 个，脚本会把 `state.status` 写为 `insufficient_participants` 并中断；后续阶段出现质量下降时才可能进入降级记录，不能视为完整 roundtable 共识。

## Codex 裁决规则

读取 transcript 后，Codex 必须判断：

- 自己的预分析中哪些关键假设被模型支持、挑战或忽略。
- 哪些观点有证据支撑。
- 哪些观点只是猜测或过度设计。
- 哪些问题会阻塞执行。
- 哪些问题只是质量风险或未来优化。
- 哪些事项需要用户确认。

存在任何等级的问题都要告知用户：

- `P0`：高危或阻塞问题，不解决不能继续。
- `P1`：正式执行前必须处理的问题，否则会影响正确性、安全性或主要目标。
- `P2`：应该处理的问题，会影响质量、维护性或边界情况，但不阻塞主线。
- `P3`：可延后优化项。
- `P4`：未来扩展或体验增强建议。

如果存在 `P0` / `P1`，或任务边界仍不明确，先告知用户问题并询问是否修正或生成计划。若只存在 `P2` 到 `P4`，且边界清晰，Codex 可以先生成计划草案，再询问是否需要调整后执行。

Codex 预分析不会发送给参与模型，只写入 transcript/state 作为裁决基线，避免模型被 Codex 先验锚定。

## 安全规则

- 不把 API key、token、provider secret 或 profile 快照写入 prompt、transcript、计划或最终回复。
- 不使用 `~/.claude/api-profiles.json`；本 skill 使用 `~/.claude/profiles/<profile>/`。
- 不生成临时 settings 文件。
- 不在 roundtable 调用中使用 `global-overwrite`。
- 除非用户明确要求实现且 Codex 另行定义有边界的委派，否则不要让模型编辑文件。
- 即使在受限只读模式中，也只允许就事论事读取 `--read-scope` 指定范围；不允许为了“了解项目”无目的扫描全仓库。
- 不接受模型关于本地文件的声称，必须由 Codex 自行检查。
- 记录失败或跳过的 profile；如果影响结论可信度，最终综合时必须告知用户。

## 参考文件

- 完整使用说明、运行模式、命令示例和排障：`references/usage.md`。
- profile 保存、健康状态、独立 settings 和安全说明：`references/profile-management.md`。
- Prompt 细节和讨论阶段约束：`references/prompt-patterns.md`。
- 本 skill 自带的 profile 脚本：`scripts/switch-api.js`。
- Roundtable 控制器：`scripts/roundtable.js`。
