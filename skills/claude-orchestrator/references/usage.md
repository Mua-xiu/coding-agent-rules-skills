# Claude Orchestrator 使用说明

## 工作模式

此 skill 的目标不是让用户直接操作 Claude Code，而是让 Codex 主导协作：

```text
用户在 Codex 中提出任务
-> Codex 判断是否适合委派
-> Codex 按固定分工选择 xhxGPT / deepseek / mimo
-> Codex 切换 Claude profile
-> Codex 启动 Claude 并发送边界明确的任务
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

| Profile | 适合任务 | 不适合任务 |
| --- | --- | --- |
| `xhxGPT` | 架构审查、风险删除、图/Schema 变更、大范围重构、安全/认证/数据风险审查 | 低价值机械修改 |
| `deepseek` | 明确边界后的功能实现、代码清理、测试补齐、文档补充、结构化跟进 | 高风险架构判断 |
| `mimo` | 格式化类修改、模板更新、简单文件移动、重复文本清理、低风险批量整理 | 复杂实现和高风险审查 |

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

2. 手动把 Claude Code 切到目标账号/provider，例如 `xhxGPT`。

3. 保存当前配置为 profile：

```powershell
node "$SkillDir\scripts\switch-api.js" --init-current xhxGPT
```

4. 对 `deepseek`、`mimo` 重复同样流程：

```powershell
node "$SkillDir\scripts\switch-api.js" --init-current deepseek
node "$SkillDir\scripts\switch-api.js" --init-current mimo
```

5. 查看已保存的 profile：

```powershell
node "$SkillDir\scripts\switch-api.js" --list
```

6. 检查当前 Claude live 配置和 active profile：

```powershell
node "$SkillDir\scripts\switch-api.js" --status
```

第 5、6 步是可选检查。真正“保存当前账号为 profile”的命令只有 `--init-current <profile>`；`--status` 只是查看当前状态，不会保存、覆盖或切换账号。

## 日常委派流程

1. Codex 先判断是否值得委派。
2. 按固定分工选择 `xhxGPT`、`deepseek` 或 `mimo`。
3. 切换 Claude profile 并启动 Claude：

```powershell
node "$SkillDir\scripts\switch-api.js" deepseek
claude
```

4. 给 Claude 的任务必须边界明确，例如：

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

5. Codex 根据真实 diff 和验证结果验收，不接受只来自 Claude 自述的结论。

## 命令清单：switch-api.js

`switch-api.js` 负责保存、查看和切换 Claude profile。它会读写用户目录下的 Claude 配置，不会把 profile 保存到本仓库。

| 命令 | 作用 | 常见场景 |
| --- | --- | --- |
| `node "$SkillDir\scripts\switch-api.js" --help` | 查看脚本帮助。 | 不确定参数时先看帮助。 |
| `node "$SkillDir\scripts\switch-api.js" --init-current xhxGPT` | 把当前 Claude live 配置保存为 `xhxGPT` profile。 | 初次配置或重新保存账号。 |
| `node "$SkillDir\scripts\switch-api.js" --init-current deepseek` | 把当前 Claude live 配置保存为 `deepseek` profile。 | 初次配置或重新保存账号。 |
| `node "$SkillDir\scripts\switch-api.js" --init-current mimo` | 把当前 Claude live 配置保存为 `mimo` profile。 | 初次配置或重新保存账号。 |
| `node "$SkillDir\scripts\switch-api.js" xhxGPT` | 切换到 `xhxGPT` profile。 | 高风险审查或架构判断。 |
| `node "$SkillDir\scripts\switch-api.js" deepseek` | 切换到 `deepseek` profile。 | 中等复杂度实现、测试、文档。 |
| `node "$SkillDir\scripts\switch-api.js" mimo` | 切换到 `mimo` profile。 | 低风险机械修改。 |
| `node "$SkillDir\scripts\switch-api.js" --list` | 列出所有 profile，并标记当前 active profile。 | 查看已有账号配置。 |
| `node "$SkillDir\scripts\switch-api.js" --status` | 查看当前 Claude live 配置摘要，token 会被遮蔽。 | 排查当前是否切到预期账号。 |
| `node "$SkillDir\scripts\switch-api.js" deepseek --dry-run` | 预览切换会复制哪些文件，不实际改配置。 | 切换前确认路径。 |
| `node "$SkillDir\scripts\switch-api.js" deepseek --no-backup` | 切换 profile 但不备份当前 live 配置。 | 只在明确不需要回滚时使用。 |
| `node "$SkillDir\scripts\switch-api.js" --profiles-root "D:\profiles" --list` | 使用自定义 profile 根目录。 | 不想把 profile 放在默认用户目录时。 |

## 账号配置和备份位置

profile 快照默认保存到用户目录：

```text
~/.claude/profiles/<profile>/
```

切换前的 live 配置备份默认保存到：

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
- xhxGPT：负责 xxx 高风险审查。
- deepseek：负责 xxx 实现或测试。
- mimo：负责 xxx 机械整理。

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

`scripts/switch-api.js`：保存、查看、切换 Claude profile。它只在用户目录读写真实 Claude 配置。

`references/profile-management.md`：profile 存储和维护说明。只有账号切换异常、Claude Code 配置位置变化、增加 provider 时才需要读取。

`references/usage.md`：给后续维护者看的使用说明。正常执行任务时不必全部读入上下文。

动态角色配置和硬门禁理念已移到同级备忘目录 `skills/claude-orchestrator-runtime-gate-notes/`，不属于当前 active skill。
