# Claude Orchestrator 使用说明

## 工作模式

此 skill 的目标不是让用户直接操作 Claude Code，而是让 Codex 主导协作：

```text
用户在 Codex 中提出任务
-> Codex 忽略上一轮 Claude 协作记录中的默认角色和旧任务
-> Codex 判断是否适合委派
-> Codex 按固定分工选择 architect / implementer / mechanic
-> Codex 获取对应 profile 的独立 settings 路径
-> Codex 使用 claude --settings + --setting-sources project,local 启动 Claude 并发送边界明确的任务
-> Claude 返回 handoff
-> Codex 检查真实 diff 和测试
-> 不合格时最多再委派一次返工
-> 仍不合格则 Codex 本地接管
```

建议使用显式入口：

```text
/claude-orchestrator 帮我让 Claude Code 审查当前改动，并由 Codex 最终验收
```

如果当前 Codex 环境使用 `$skill` 形式，则使用：

```text
$claude-orchestrator 帮我让 Claude Code 补齐测试，并由 Codex 审查
```

## 固定账号分工

当前版本采用固定 profile 约定，不再要求用户维护 `profile-roles.json`。

这三个 profile 名称表示任务职责，不表示具体模型厂商或账号名称。初次配置时，只需要把当前最适合该职责的 Claude/provider 账号保存到对应 profile：高判断成本账号保存为 `architect`，中等复杂度执行账号保存为 `implementer`，低风险机械整理账号保存为 `mechanic`。

如果暂时只有一个可用模型账号，也可以把 `architect`、`implementer`、`mechanic` 都保存为同一个实际账号，例如三者都绑定 Claude，或三者都绑定 DeepSeek。这样做仍然有意义：Codex 会按任务职责选择 profile，后续你有更合适的账号时，只需要重新保存对应 profile，不需要改 skill 规则。

| Profile | 建议绑定的账号能力 | 适合任务 | 不适合任务 |
| --- | --- | --- | --- |
| `architect` | 推理、架构判断、风险识别能力最强的账号，例如 Claude、Gemini 或其他高能力模型账号 | 架构审查、风险删除、图/Schema 变更、大范围重构、安全/认证/数据风险审查 | 低价值机械修改 |
| `implementer` | 执行稳定、成本适中、适合持续改代码的账号，例如 DeepSeek 或其他代码执行型账号 | 明确边界后的功能实现、代码清理、测试补齐、文档补充、结构化跟进 | 高风险架构判断 |
| `mechanic` | 成本低、速度快、适合重复整理的账号，例如 Mimo 或其他轻量账号 | 格式化类修改、模板更新、简单文件移动、重复文本清理、低风险批量整理 | 复杂实现和高风险审查 |

不建议把 profile 改成具体厂商名或个人账号名，因为 Codex 的分工规则需要稳定名称。如果确实要改名，必须同步修改 `SKILL.md`、本说明文档和所有命令示例。

如果任务很小、边界不清、或调用 Claude 的成本高于直接处理，Codex 应自己完成。

## 命令运行位置

所有 Node 脚本都建议用 `$SkillDir` 绝对路径运行，这样无论当前 PowerShell 位于哪个目录，都不会把 `skills\...` 误解析到 `C:\Windows\system32`。

已安装到 Codex 后，推荐先定义：

```powershell
$CodexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME ".codex" }
$SkillDir = Join-Path $CodexHome "skills\claude-orchestrator"
```

`$SkillDir` 在同一个 PowerShell 会话中只需要定义一次。后续命令都复用这个变量；只有关闭并重新打开 PowerShell 后才需要重新定义。

## 初次配置流程

1. 确认 Claude Code 可用：

```powershell
claude --version
```

2. 手动把 Claude Code 切到适合高判断成本任务的账号/provider，例如 Claude、Gemini 或其他高能力模型账号。

3. 保存当前配置为高判断成本 profile：

```powershell
node "$SkillDir\scripts\switch-api.js" --init-current architect
```

4. 再分别切到适合中等复杂度执行、低风险机械整理的账号/provider 后，重复保存：

```powershell
node "$SkillDir\scripts\switch-api.js" --init-current implementer
node "$SkillDir\scripts\switch-api.js" --init-current mechanic
```

5. 查看已保存的 profile：

```powershell
node "$SkillDir\scripts\switch-api.js" --list
```

6. 检查默认模式、旧版覆盖模式 active profile 和当前 Claude live 配置：

```powershell
node "$SkillDir\scripts\switch-api.js" --status
```

第 5、6 步是可选检查。真正“保存当前账号为 profile”的命令只有 `--init-current <profile>`；保存后脚本会立即执行一次健康探测并写入 `health.json`。`--status` 只是查看当前状态，不会保存、覆盖或切换账号。

## 日常委派流程

1. Codex 只根据本次用户请求和当前仓库状态判断是否值得委派，不直接复用上一次 Claude 的角色、任务或 prompt。
2. 按本次任务的实际风险、复杂度和交付物重新选择 `architect`、`implementer` 或 `mechanic`。
3. 读取 profile settings 路径，并按需检查健康状态：

```powershell
node "$SkillDir\scripts\switch-api.js" --ping implementer
$SettingsPath = node "$SkillDir\scripts\switch-api.js" --settings-path implementer
```

4. 使用独立 settings 启动 Claude：

```powershell
claude --settings "$SettingsPath" --setting-sources project,local
```

5. 给 Claude 的任务必须边界明确，例如：

```text
You are working in C:\path\to\project.

Task:
补齐 user-service 的单元测试。

Constraints:
- Only change: tests/user-service/*
- Do not change: src/user-service/*
- Run: npm test -- user-service

Return:
- Summary of changes
- Files changed
- Validation performed
- Remaining issues
```

6. 如果通过非交互命令调用 Claude，按任务边界补齐权限和超时：

```powershell
$prompt = @'
You are working in C:\path\to\project.
Read-only analysis only.

Inspect:
- C:\path\to\project\src\feature.ts
- D:\external-reference\legacy.html

Do not edit files.
Return concise structured findings.
'@

claude -p $prompt `
  --settings "$SettingsPath" `
  --setting-sources project,local `
  --output-format text `
  --permission-mode dontAsk `
  --add-dir "D:\external-reference" `
  --allowedTools Read,Glob,Grep `
  --effort low
```

当目标文件或参考资料不在 `You are working in ...` 指定的工作目录内时，必须为外部目录添加 `--add-dir`。只读分析优先限制为 `Read,Glob,Grep`，并使用 `--effort low` 降低响应时间。通过 Codex shell 调用时，命令等待时间建议至少 180 秒。

7. Codex 根据真实 diff 和验证结果验收，不接受只来自 Claude 自述的结论。

默认流程不会覆盖 `~/.claude/settings.json`。`--setting-sources project,local` 是独立调用的必要参数，用来排除当前全局 user settings；否则 `claude --settings <file>` 仍可能叠加读取全局配置。如果某个特殊账号/provider 无法通过独立 settings 正常运行，才使用旧版回退模式：

```powershell
node "$SkillDir\scripts\switch-api.js" implementer --mode global-overwrite
```

该命令会先备份再覆盖全局 Claude 配置，日常委派不要使用。

## 健康状态

每个 profile 的健康状态保存到：

```text
~/.claude/profiles/<profile>/health.json
```

- `status=ok` 且未超过 TTL 时，普通 `--ping` 会复用最近结果，减少额外模型调用。
- `status=down` 时，下一次 `--ping` 会重新探测。
- 实际 Claude 调用失败后，使用 `node "$SkillDir\scripts\switch-api.js" --ping implementer --force` 强制刷新。
- 使用 `--ping-all` 检查全部 profile；使用 `--refresh-health` 强制刷新全部 profile。
- `health.json` 使用临时文件和 rename 原子写入，避免并发读取到半写入内容。

## 会话连续性边界

`Claude 协作记录` 和 handoff 是审查、续作和排障材料，不是下一次 skill 调用的默认调度计划。

- 新任务或新一次独立调用时，必须重新分析任务，再决定是否委派以及选择哪个 profile。
- 只有用户明确说“继续上次 Claude 任务”“按 handoff 接着做”，或当前任务明显依赖上一轮未完成工作时，才读取旧 handoff。
- 即使读取旧 handoff，也要重新确认本次任务边界、允许修改范围、验证命令和 profile 选择。
- 最终回复里的 `architect`、`implementer`、`mechanic` 记录只说明上一轮实际分工，不能作为下一轮默认角色安排。

## Claude 调用超时排查

常见“权限超时”不一定是 Codex 权限不足，可能是 Claude Code 的权限模式、跨目录读取和当前 profile 配置叠加导致。

- `--permission-mode dontAsk` 读取工作目录外文件时，应同步使用 `--add-dir <外部目录>`。
- 当前 profile 如果使用较高 `effortLevel`、自定义 `ANTHROPIC_BASE_URL` 或模型别名，文件读取和工具调用可能明显变慢。
- 一次 prompt 同时要求读取多个大文件、分析状态机、追踪资源路径时，优先拆成多个小任务。
- 完全可信的本地目录中，如只为避免权限弹窗和超时，可临时使用 `--dangerously-skip-permissions --effort low`；该方式会绕过权限确认，不应作为默认命令模板。

## 命令清单：switch-api.js

`switch-api.js` 负责保存、查看、解析和探测 Claude profile。默认模式只解析独立 settings 路径，不覆盖全局 Claude 配置；旧版覆盖流程必须显式启用。

| 命令 | 作用 | 常见场景 |
| --- | --- | --- |
| `node "$SkillDir\scripts\switch-api.js" --help` | 查看脚本帮助。 | 不确定参数时先看帮助。 |
| `node "$SkillDir\scripts\switch-api.js" --init-current architect` | 把当前 Claude live 配置保存为 `architect` profile。 | 初次配置或重新保存账号。 |
| `node "$SkillDir\scripts\switch-api.js" --init-current implementer` | 把当前 Claude live 配置保存为 `implementer` profile。 | 初次配置或重新保存账号。 |
| `node "$SkillDir\scripts\switch-api.js" --init-current mechanic` | 把当前 Claude live 配置保存为 `mechanic` profile。 | 初次配置或重新保存账号。 |
| `node "$SkillDir\scripts\switch-api.js" implementer` | 显示 `implementer` 的独立 settings 调用示例。 | 人工查看默认调用方式。 |
| `node "$SkillDir\scripts\switch-api.js" --settings-path implementer` | 只输出 `implementer` 的 settings 路径。 | 通过命令替换拼接 `claude --settings "$SettingsPath" --setting-sources project,local`。 |
| `node "$SkillDir\scripts\switch-api.js" --ping implementer` | 探测或复用 `implementer` 健康状态。 | 委派前确认账号活性。 |
| `node "$SkillDir\scripts\switch-api.js" --ping implementer --force` | 强制重新探测 `implementer`。 | 实际调用失败后刷新状态。 |
| `node "$SkillDir\scripts\switch-api.js" --ping-all` | 探测全部 profile，允许复用 TTL 内的成功状态。 | 批量检查账号活性。 |
| `node "$SkillDir\scripts\switch-api.js" --refresh-health` | 强制刷新全部 profile。 | 需要完整重新测活时使用。 |
| `node "$SkillDir\scripts\switch-api.js" --list` | 列出所有 profile、模型摘要和最近健康状态。 | 查看已有账号配置。 |
| `node "$SkillDir\scripts\switch-api.js" --status` | 查看默认模式、旧覆盖 active profile 和 live 配置摘要，token 会被遮蔽。 | 排查当前配置。 |
| `node "$SkillDir\scripts\switch-api.js" implementer --mode global-overwrite --dry-run` | 预览旧版覆盖模式会复制哪些文件。 | 回退前确认路径。 |
| `node "$SkillDir\scripts\switch-api.js" implementer --mode global-overwrite` | 备份并覆盖全局 Claude 配置。 | 仅在独立 settings 无法工作时回退。 |
| `node "$SkillDir\scripts\switch-api.js" implementer --mode global-overwrite --no-backup` | 覆盖全局配置但不备份。 | 只在明确不需要回滚时使用。 |
| `node "$SkillDir\scripts\switch-api.js" --profiles-root "D:\profiles" --list` | 使用自定义 profile 根目录。 | 不想把 profile 放在默认用户目录时。 |

## 账号配置和备份位置

profile 快照默认保存到用户目录：

```text
~/.claude/profiles/<profile>/
```

只有显式使用 `--mode global-overwrite` 时，覆盖前的 live 配置备份才会保存到：

```text
~/.claude/profile-switch-backups/
```

这些目录可能包含 token，不能提交到 git。

## Handoff 规则

切换 profile、重启 Claude 或结束 Claude 会话前，要求 Claude 在工作区留下 handoff 说明。

如果项目没有更合适的位置，使用：

```text
docs/claude-handoff-<topic>.md
```

handoff 至少包含：

- 任务目标
- 已完成内容
- 修改文件
- 已运行测试和结果
- 未解决问题
- 下一步建议

## 审查原则

Codex 验收时优先看：

- 真实 diff
- 测试或验证命令
- 是否越界修改
- 是否满足用户目标
- 是否引入明显风险

失败、超时、输出矛盾或高风险任务时，再读取详细日志或 handoff。

## 最终反馈中的调度说明

使用此 skill 后，Codex 的最终回复需要保留正常交付反馈，包括完成内容、改动文件、验证结果、风险或后续建议。Claude 调度说明只是追加信息，用来说明本次是否委派了 Claude，以及不同 profile 分别负责了什么。

推荐格式：

```text
Claude 协作记录：
- architect：负责 xxx 高风险审查。
- implementer：负责 xxx 实现或测试。
- mechanic：负责 xxx 机械整理。

Codex 验收：
已检查 diff，并运行 xxx 测试；未发现需要返工的问题。
```

如果没有调用 Claude：

```text
Claude 协作记录：未使用，本次由 Codex 直接完成。
```

这段内容应简短，不输出完整 Claude 过程、不输出 token、不替代 Codex 自身的验收结论。

## 文件职责

`SKILL.md`：Codex 触发 skill 后读取的核心规则，负责固定分工、委派和审查流程。

`scripts/switch-api.js`：CLI 薄入口，只负责把命令分发给 `scripts/lib/` 下的模块。

`scripts/lib/constants.js`：路径、模式、TTL、隔离调用参数和旧版回退管理文件清单。

`scripts/lib/args.js`：命令行参数解析和单主操作约束。

`scripts/lib/fs-json.js`：路径展开、JSON 读写和原子写入。

`scripts/lib/profile-store.js`：profile 路径、settings 摘要、列表、状态展示和 settings 路径输出。

`scripts/lib/health.js`：健康探测、`health.json` 写入、TTL 复用和失败计数。

`scripts/lib/profile-init.js`：保存当前 live 配置为 profile，并执行首次健康探测。

`scripts/lib/global-overwrite.js`：旧版全局覆盖回退和备份逻辑。

`scripts/lib/output.js`：用户可见错误和帮助文本输出。

`references/profile-management.md`：profile 存储和维护说明。只有账号切换异常、Claude Code 配置位置变化、增加 provider 时才需要读取。

`references/usage.md`：给后续维护者看的使用说明。正常执行任务时不必全部读入上下文。

动态角色配置和硬门禁理念已移到同级备忘目录 `skills/claude-orchestrator-runtime-gate-notes/`，不属于当前 active skill。
