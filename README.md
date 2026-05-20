# Coding Agent Rules & Skills

这个仓库用于集中维护个人常用的 Coding Agent 协作规则、Codex skills 和 Claude Code skills，方便同步到 GitHub 后在不同项目、不同机器、不同 coding 工具中复用。

## 目录结构

```text
.
├── AGENTS.md                         # Codex 等支持 AGENTS.md 的 coding agent 通用规则模板
└── skills/
    ├── daily-log-sync/               # Claude Code 日志同步 skill
    │   ├── SKILL.md
    │   ├── README.md
    │   ├── reference.md
    │   ├── template.md
    │   ├── LICENSE
    │   └── examples/
    └── claude-orchestrator/          # Codex 调度本机 Claude Code 协作的 skill
        ├── SKILL.md
        ├── agents/openai.yaml
        ├── scripts/
        └── references/
```

## 通用规则文件

### AGENTS.md

[AGENTS.md](AGENTS.md) 是推荐维护的通用规则模板，适合放跨工具通用的协作习惯，例如：

- 使用中文回答和解释；
- 优先推荐改动最小但有效可靠的方案；
- 修改代码时保持中文注释习惯；
- 不确定旧代码是否删除时先询问；
- `/daily-log-sync` 日志同步规则入口。

后续如果通用规则需要调整，优先修改 [AGENTS.md](AGENTS.md)，再根据目标 Agent 的默认规则文件名复制或改名使用。

### 按 Agent 调整规则文件名

不同 Coding Agent 自动读取的规则文件名不同。实际使用时，建议把 [AGENTS.md](AGENTS.md) 的内容直接复制或改名成目标 Agent 默认会读取的文件，而不是再通过另一个规则文件转引用。

这样可以让 Agent 在启动时直接携带完整规则，减少“入口文件被读取了，但被引用文件没有稳定生效”导致的不按规则执行问题。

常见用法示例：

- Claude Code：将 [AGENTS.md](AGENTS.md) 复制或改名为项目根目录的 `CLAUDE.md`，内容直接写完整规则。
- Codex：直接使用项目根目录的 [AGENTS.md](AGENTS.md)，内容写完整规则。
- 其他 Coding Agent：按对应工具文档要求，把同一份规则内容放到它默认会自动读取的规则文件名中。

如果多个工具共用同一项目，可以保留多份入口文件，但应尽量让每个入口文件都包含完整规则正文，避免只依赖跨文件引用。

### Codex / AGENTS.md

[AGENTS.md](AGENTS.md) 是 Codex 等工具常见的规则入口。实际项目中应直接放入完整规则正文，避免只写一个转引用说明。

## daily-log-sync skill

[daily-log-sync](skills/daily-log-sync/) 用于维护当天工程复盘日志。

它的目标不是生成浅层日报，而是把当天实际分析、排查、修改和最终结论整理成可复盘的工程日志。

适合记录：

- 问题现象；
- 排查分析；
- 实际存在时的误判方向、候选方向或风险取舍；
- 最终正确结论；
- 为什么最终这样改；
- 最终修改结果；
- 待后续完善问题。

## 在 Claude Code 中使用 daily-log-sync

将 skill 复制到 Claude Code 的 skills 目录，例如 Windows：

```bash
cp -R skills/daily-log-sync "C:/Users/kin/.claude/skills/"
```

安装后，在 Claude Code 中可以输入：

```text
/daily-log-sync
```

也可以使用自然语言触发，例如：

```text
总结今天的分析和问题
更新今天的日志
整理今天的排查结论
```

默认会在当前项目根目录维护当天日期日志，例如：

```text
2026-05-07.md
```

如果当天日志已存在，会优先读取并增量更新，不会重复新建。

## claude-orchestrator skill

[claude-orchestrator](skills/claude-orchestrator/) 用于在 Codex 中显式委派本机 Claude Code 协作：Codex 接收用户任务后，按固定分工选择 `architect`、`implementer`、`mechanic` 三个 Claude/provider profile，切换账号配置并让 Claude Code 完成边界明确的子任务，最后由 Codex 检查真实 diff、测试结果和风险后决定是否接受。

这个 skill 适合：

- 让 Claude Code 做独立审查、批量修改、测试补齐、文档整理；
- 使用不同 Claude/provider 账号处理不同风险等级的任务；
- 需要在切换账号或结束 Claude 会话前留下 handoff；
- 需要 Codex 对 Claude 的最终产物做验收。

这个 skill 不适合普通小改动默认自动触发。它会调用外部模型、切换本机 Claude profile，并可能修改项目文件，因此推荐使用显式入口：

```text
/claude-orchestrator <任务描述>
```

如果当前 Codex 环境使用 `$skill` 形式，则使用：

```text
$claude-orchestrator <任务描述>
```

固定分工如下。profile 名称按职责命名，不绑定具体模型厂商；初次配置时，把你当前最适合该职责的 Claude、Gemini、DeepSeek、Mimo 或其他 provider 账号保存到对应 profile 即可。如果暂时只有一个可用账号，也可以把三个 profile 都保存为同一个实际账号，例如都绑定 Claude 或都绑定 DeepSeek。

| Profile | 建议绑定的账号能力 | 适合任务 |
| --- | --- | --- |
| `architect` | 推理、架构判断、风险识别能力最强的账号 | 架构审查、风险删除、图/Schema 变更、大范围重构、安全/认证/数据风险审查。 |
| `implementer` | 执行稳定、成本适中、适合持续改代码的账号 | 明确边界后的功能实现、代码清理、测试补齐、文档补充、结构化跟进。 |
| `mechanic` | 成本低、速度快、适合重复整理的账号 | 格式化类修改、模板更新、简单文件移动、重复文本清理、低风险批量整理。 |

初次使用时，需要先手动切到对应能力的 Claude Code 账号/provider，再把当前配置保存为 profile。下面三个命令分别保存高判断成本任务、中等复杂度执行和低风险机械任务的 profile：

```powershell
$CodexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME ".codex" }
$SkillDir = Join-Path $CodexHome "skills\claude-orchestrator"

# 切到适合高判断成本任务的账号/provider 后执行
node "$SkillDir\scripts\switch-api.js" --init-current architect

# 切到适合中等复杂度执行任务的账号/provider 后执行
node "$SkillDir\scripts\switch-api.js" --init-current implementer

# 切到适合低风险机械任务的账号/provider 后执行
node "$SkillDir\scripts\switch-api.js" --init-current mechanic
```

`$SkillDir` 在同一个 PowerShell 会话中只需要定义一次；`--status` 只是查看当前配置的可选检查命令，不是保存 profile 的必需步骤。

日常委派任务时，Codex 按固定分工选择 profile，然后切换账号并启动 Claude：

```powershell
node "$SkillDir\scripts\switch-api.js" implementer
claude
```

完整命令清单见 [usage.md](skills/claude-orchestrator/references/usage.md)。

账号/profile 快照保存在用户目录，不放入本仓库：

```text
~/.claude/profiles/<profile>/
```

动态角色配置和硬门禁方案已经移出 active skill，作为备忘保存在同级 notes 目录中。该目录不是 skill，只用于记录后续如果改做插件、CLI 或 hook 时可参考的方案。

更完整的使用说明见 [usage.md](skills/claude-orchestrator/references/usage.md)，账号/profile 管理说明见 [profile-management.md](skills/claude-orchestrator/references/profile-management.md)。

## 在新项目中使用规则

推荐先复制通用规则模板，再按目标 Agent 的默认规则文件名落地：

```text
AGENTS.md                         # Codex 等工具使用，内容应直接包含完整规则
CLAUDE.md                         # Claude Code 使用时可由 AGENTS.md 复制/改名得到，内容应直接包含完整规则
```

如果只使用 Claude Code，可以只放：

```text
CLAUDE.md
```

如果只使用支持 [AGENTS.md](AGENTS.md) 的工具，可以只放：

```text
AGENTS.md
```

核心原则是：**哪个 Agent 会自动读取哪个文件，就把完整规则正文放进那个文件里**，不要只放“请参考另一个文件”的转引用说明。

## 维护建议

- 通用协作规则优先维护在 [AGENTS.md](AGENTS.md)。
- 面向具体 Agent 使用时，按该工具默认读取的规则文件名复制/改名，并让入口文件直接包含完整规则正文。
- Claude Code 使用 `CLAUDE.md` 时，不建议只写“引用 AGENTS.md”，应直接放入完整规则，避免规则没有被稳定携带。
- Codex 等支持 [AGENTS.md](AGENTS.md) 的工具，直接使用 [AGENTS.md](AGENTS.md)，并确保其中是完整规则正文。
- Skill 的详细规则维护在 [skills/daily-log-sync/SKILL.md](skills/daily-log-sync/SKILL.md)。
- Codex 调度 Claude Code 协作的详细规则维护在 [skills/claude-orchestrator/SKILL.md](skills/claude-orchestrator/SKILL.md)。
