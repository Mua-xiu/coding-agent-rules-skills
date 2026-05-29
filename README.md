# Coding Agent Rules & Skills

这个仓库用于维护个人常用的 Coding Agent 协作规则模板、Codex skills、Claude Code skills，以及本仓库自身的 Agent 协作文档，方便同步到 GitHub 后在不同项目、不同机器和不同 coding 工具中复用。

## 目录结构

```text
.
├── AGENTS.md                         # 本仓库专属渐进披露入口：元规则 + 规则索引 + 阅读路径
├── AGENTS-template.md                # 可复制到其他项目的通用 Coding Agent 协作规则模板
├── AGENTSDOC/
│   ├── rules/
│   │   └── global/
│   │       ├── shared-skills.md       # 多 skill 共享脚本与状态读写协议纪律
│   │       └── skill-script-i18n.md   # skill 脚本中英双语提示规范
│   └── plans/                         # 本地过程文档工作台，默认不入库
└── skills/
    ├── daily-log-sync/                # Claude Code 日志同步 skill
    └── claude-orchestrator/           # Codex 调度本机 Claude Code 协作的 skill
```

## 协作文档

[AGENTS.md](AGENTS.md) 是本仓库专属入口，不是通用模板。它不重复通用协作规则，只维护本仓库的渐进披露规则索引：

1. Agent 先读取 `AGENTS.md`，确认本次任务是否命中项目专属规则。
2. 按 `AGENTS.md` 中的索引读取命中的 `AGENTSDOC/rules/...` 细则。
3. 未命中的细则不主动读取，避免上下文膨胀。

[AGENTSDOC/rules/](AGENTSDOC/rules/) 入库，用于保存本项目专属细则；规则索引统一维护在 [AGENTS.md](AGENTS.md) 中。

`AGENTSDOC/plans/` 是本地工作台，用于计划、重构、复盘、基线等过程文档，默认不入库。入库文档不要链接到 `plans/` 下的具体文件，避免克隆仓库后出现死链。

## 通用规则模板

[AGENTS-template.md](AGENTS-template.md) 是可复制到其他项目的通用 Coding Agent 协作规则模板，保留跨项目通用的协作习惯，例如中文回复、最小有效改动、任务边界确认、中文注释规则和旧代码处理偏好。

使用时按目标工具的规则文件名复制或改名：

- Codex：复制为目标项目根目录的 `AGENTS.md`。
- Claude Code：复制为目标项目根目录的 `CLAUDE.md`，或按当前 Claude Code 版本支持的规则入口放置。
- 其他 Coding Agent：按对应工具文档要求，复制到它默认读取的规则文件名。

注意：本仓库根目录的 [AGENTS.md](AGENTS.md) 是项目专属入口，不建议直接复制到其他项目；跨项目复用请使用 [AGENTS-template.md](AGENTS-template.md)。

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

安装到 Claude Code skills 目录后，可以输入：

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

固定分工如下。profile 名称按职责命名，不绑定具体模型厂商；初次配置时，把你当前最适合该职责的 Claude、Gemini、DeepSeek、Mimo 或其他 provider 账号保存到对应 profile 即可。

| Profile | 建议绑定的账号能力 | 适合任务 |
| --- | --- | --- |
| `architect` | 推理、架构判断、风险识别能力最强的账号 | 架构审查、风险删除、图/Schema 变更、大范围重构、安全/认证/数据风险审查。 |
| `implementer` | 执行稳定、成本适中、适合持续改代码的账号 | 明确边界后的功能实现、代码清理、测试补齐、文档补充、结构化跟进。 |
| `mechanic` | 成本低、速度快、适合重复整理的账号 | 格式化类修改、模板更新、简单文件移动、重复文本清理、低风险批量整理。 |

完整命令清单见 [usage.md](skills/claude-orchestrator/references/usage.md)，账号/profile 管理说明见 [profile-management.md](skills/claude-orchestrator/references/profile-management.md)。

账号/profile 快照保存在用户目录，不放入本仓库：

```text
~/.claude/profiles/<profile>/
```

## 维护建议

- 本项目协作入口维护在 [AGENTS.md](AGENTS.md)，负责项目专属元规则、渐进披露索引和阅读路径，不重复通用规则。
- 通用协作模板维护在 [AGENTS-template.md](AGENTS-template.md)；跨项目规则变化优先同步到该文件。
- 本项目专属细则维护在 [AGENTSDOC/rules/](AGENTSDOC/rules/)；新增或调整细则时，同步更新 [AGENTS.md](AGENTS.md) 的规则索引。
- 过程文档一律放到 `AGENTSDOC/plans/<模块>/`，不在仓库根目录扩散，也不入库。
- Skill 的详细规则维护在各自的 `SKILL.md` 中，例如 [daily-log-sync/SKILL.md](skills/daily-log-sync/SKILL.md) 和 [claude-orchestrator/SKILL.md](skills/claude-orchestrator/SKILL.md)。
- 改动共享 profile 脚本或脚本对 `~/.claude/profiles/` 的读写协议时，先读取 [shared-skills.md](AGENTSDOC/rules/global/shared-skills.md)。
- 修改 `skills/*/scripts/` 下脚本的用户可见输出时，先读取 [skill-script-i18n.md](AGENTSDOC/rules/global/skill-script-i18n.md)。
