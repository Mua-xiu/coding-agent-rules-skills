# Claude Roundtable 使用说明

## 工作模式

`claude-roundtable` 是一个可独立安装和使用的多 profile 讨论 skill。即使没有安装 `claude-orchestrator`，本 skill 也自带 `scripts/switch-api.js` 和 `scripts/lib/`，可以完成 profile 保存、健康探测、独立 settings 调用和讨论记录写入。

典型流程：

```text
用户提出需要多模型/多账号讨论的问题
-> Codex 整理讨论主题、边界、已知事实和期望输出
-> Codex 先形成自己的预分析和风险基线
-> Codex 判断使用纯文本讨论还是受限只读讨论
-> roundtable 选择至少两个可用 profile，并按 TTL 执行健康探测
-> 每个参与者完成独立首轮、互评和修订
-> 控制器写入 transcript/state/messages/failures
-> Codex 读取记录并做最终 P0-P4 裁决
```

## Claude Code 版本兼容说明

当前脚本和命令是在 `2.1.146 (Claude Code)` 下开发、测试和验证的。更高或更低版本可能存在参数、settings 读取方式、权限模式或认证存储位置差异。用户下载后可以根据自己的 Claude Code 版本、provider 配置和实际需求调整脚本与命令。

## 命令运行位置

建议在目标项目根目录运行 roundtable，这样运行记录会写入目标项目的 `roundtable-runs/`：

```powershell
Set-Location "D:\path\to\project"
```

已安装到 Codex 后，推荐定义：

```powershell
$CodexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME ".codex" }
$SkillDir = Join-Path $CodexHome "skills\claude-roundtable"
```

## 初次配置 profile

profile 名称表示讨论职责，不表示具体模型厂商。常用名称：

| Profile | 建议能力 | 在讨论中的用途 |
| --- | --- | --- |
| `architect` | 推理、架构判断、风险识别强 | 方案取舍、风险、缺失边界 |
| `implementer` | 执行稳定、代码和测试经验强 | 可落地步骤、实现成本、验证方式 |
| `mechanic` | 速度快、适合机械检查 | 清单、格式、重复项、明显遗漏 |

如果暂时只有一个实际账号，也可以把多个 profile 都保存为同一个账号。保留职责名称有利于后续替换账号，不需要改 skill 规则。

保存当前 Claude Code 配置为 profile：

```powershell
node "$SkillDir\scripts\switch-api.js" --init-current architect
node "$SkillDir\scripts\switch-api.js" --init-current implementer
node "$SkillDir\scripts\switch-api.js" --init-current mechanic
```

查看 profile：

```powershell
node "$SkillDir\scripts\switch-api.js" --list
node "$SkillDir\scripts\switch-api.js" --status
```

保存后脚本会立即执行一次健康探测并写入 `health.json`。

## 运行讨论

### 纯文本讨论

题面事实已经足够时使用纯文本模式。此模式默认禁用工具，参与者不能读取文件，也不能输出 `<tool_call>` 伪工具标签。

```powershell
node "$SkillDir\scripts\roundtable.js" `
  --codex-brief "Codex baseline: 任务目标、边界、关键风险和待挑战假设。" `
  --topic "请讨论这个重构计划是否应该现在执行，并按 P0-P4 给出风险。"
```

使用文件保存长主题：

```powershell
node "$SkillDir\scripts\roundtable.js" `
  --topic-file ".\topic.md" `
  --codex-brief-file ".\codex-brief.md" `
  --profiles architect,implementer `
  --max-directed-turns 4
```

### 受限只读讨论

需要模型核对仓库事实时使用 `--read-scope`。脚本会自动使用只读工具 `Read,Glob,Grep` 并配套 `--allowedTools`。

```powershell
node "$SkillDir\scripts\roundtable.js" `
  --topic-file ".\topic.md" `
  --codex-brief-file ".\codex-brief.md" `
  --profiles all `
  --max-participants 2 `
  --read-scope ".\src\views\HomeView.vue" `
  --read-scope ".\e2e\login.spec.ts"
```

`--read-scope` 是讨论读取边界说明，不是系统级沙箱。Codex 最终必须复核模型是否越界、是否过度扫描、是否把猜测当事实。

读取工作目录外资料时，额外添加 `--add-dir`：

```powershell
node "$SkillDir\scripts\roundtable.js" `
  --topic-file ".\topic.md" `
  --codex-brief-file ".\codex-brief.md" `
  --read-scope "D:\external-reference\design.md" `
  --add-dir "D:\external-reference"
```

## 参与者选择和健康状态

- `--profiles all` 会从 `~/.claude/profiles/` 中发现 profile。
- `status=ok` 只在 5 小时 TTL 内复用；过期会重新 ping。
- `status=down` 不受 TTL 保护，下一次真实运行会重新探测。
- `--max-participants` 是当前参与者上限，不是永久截断；首轮失败时会尝试启用候补 profile。
- 健康探测后可参与账号少于 2 个时，脚本会中断并写入 `insufficient_participants`。
- 首轮结束后有效参与者少于 2 个时，脚本会中断，不继续做单账号互评/修订。
- 这些情况不能达到良好多账号讨论效果，更适合用户与 Codex 直接讨论或先修复账号配置。

手动刷新健康状态：

```powershell
node "$SkillDir\scripts\switch-api.js" --ping architect
node "$SkillDir\scripts\switch-api.js" --ping architect --force
node "$SkillDir\scripts\switch-api.js" --refresh-health
```

## 运行记录

默认写入当前工作目录：

```text
roundtable-runs/<timestamp>-<id>/
```

主要文件：

| 文件 | 作用 |
| --- | --- |
| `interactive-transcript.md` | 方便人工和 Codex 阅读的讨论记录 |
| `state.json` | 状态、参与者、健康状态、工具模式、读取范围 |
| `messages.jsonl` | 每条模型或控制器消息 |
| `failures.json` | 失败、跳过、候补和健康异常信息 |

Codex 最终裁决时必须读取这些记录，不能让模型投票替代验收。

`--codex-brief` 或 `--codex-brief-file` 的内容会写入 transcript/state，但不会发送给参与模型。它用于让 Codex 在裁决时对照自己的预分析，识别讨论是否偏离任务范围、遗漏关键风险或把次要问题抬高优先级。

## 常见问题

| 现象 | 处理 |
| --- | --- |
| `503 No available accounts` | provider 当时无可用账号。脚本会记录失败并尝试候补；必要时对该 profile 执行 `--ping <profile> --force`。 |
| 输出 `<tool_call>` / `<tool_calls>` | 控制器会判为无效响应并重试一次；仍失败则记录该 profile 输出无效。 |
| `--tools Read` 被拒绝 | 启用只读工具时必须提供 `--read-scope`，避免无边界读取。 |
| 有效参与者不足 2 个 | 本轮会中断，不应作为完整 roundtable 结论；建议先修复账号，或由用户与 Codex 直接讨论。 |
| 模型声称读过某文件 | Codex 必须自行核验本地文件和 transcript，不直接采信。 |

## 文件职责

`SKILL.md`：核心工作流、触发条件、讨论模式和安全规则。

`references/usage.md`：独立使用说明、命令示例、运行记录和排障。

`references/profile-management.md`：profile 存储、健康状态、账号维护和安全说明。

`references/prompt-patterns.md`：只有调整 prompt 或讨论阶段行为时才读取。

`scripts/switch-api.js` 和 `scripts/lib/`：profile 保存、健康探测、独立 settings 路径和旧版回退。

`scripts/roundtable.js` 和 `scripts/roundtable-lib/`：讨论控制器、参与者选择、只读模式、补位、降级状态和 transcript 写入。
