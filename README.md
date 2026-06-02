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
    ├── claude-orchestrator/           # Codex 调度本机 Claude Code 协作的 skill
    └── claude-roundtable/             # 多 Claude profile 结构化讨论 skill
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

[claude-orchestrator](skills/claude-orchestrator/) 用于在 Codex 中显式委派本机 Claude Code 协作：Codex 接收用户任务后，按固定职责选择 `architect`、`implementer`、`mechanic` 三个 Claude/provider profile，使用独立 settings 让 Claude Code 完成边界明确的子任务，最后由 Codex 检查真实 diff、测试结果和风险后决定是否接受。

### Claude Code 版本兼容说明

当前 `claude-orchestrator` 的脚本和命令是在 `2.1.146 (Claude Code)` 下开发、测试和验证的。更高或更低版本的 Claude Code 尚未在本仓库中完成验证，可能存在参数、settings 读取方式、权限模式或认证存储位置差异。

用户下载或迁移到其它机器后，可以根据自己的 Claude Code 版本、provider 配置和实际需求，自行调整相关脚本与命令；调整共享 profile 脚本或调用协议时，建议同步查看本仓库的项目规则索引和 `AGENTSDOC/rules/` 下的约束说明。

这个 skill 适合：

- 让 Claude Code 做独立审查、批量修改、测试补齐、文档整理；
- 使用不同 Claude/provider 账号处理不同风险等级的任务；
- 需要在续作、切换 profile、中断恢复时留下 handoff；
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
| `architect` | 推理、架构判断、风险识别能力最强的账号 | 需求澄清、方案设计、任务拆解、前置风险识别、只读风险审查、可选 diff 初审。 |
| `implementer` | 执行稳定、成本适中、适合持续改代码的账号 | 明确边界后的功能实现、代码清理、测试补齐、文档补充、结构化跟进。 |
| `mechanic` | 成本低、速度快、适合重复整理的账号 | 同时满足“无需语义判断、错误容易发现、有客观对错标准”的机械替换、格式化、模板填充和跨文件同步。 |

如果没有配置任何 profile、目标职责 profile 缺失，或目标 profile 多次健康探测失败，Codex 会接管对应任务，不会自动改派给其它职责 profile。委派前必须先执行 `--ping <profile>`，再读取 `--settings-path <profile>`；`status=ok` 的健康状态默认复用 5 小时，需要强制重测时使用 `--ping <profile> --force` 或 `--refresh-health`。

完整命令清单见 [usage.md](skills/claude-orchestrator/references/usage.md)，账号/profile 管理说明见 [profile-management.md](skills/claude-orchestrator/references/profile-management.md)。

账号/profile 快照保存在用户目录，不放入本仓库：

```text
~/.claude/profiles/<profile>/
```

## claude-roundtable skill

[claude-roundtable](skills/claude-roundtable/) 用于让多个本机 Claude Code profile 围绕同一问题进行结构化讨论、互评和修正，最后由 Codex 读取 transcript 后做最终裁决、P0-P4 问题分级和下一步建议。

这个 skill 默认从 `~/.claude/profiles/` 自动发现可用 profile，复用 `claude-orchestrator` 的独立 settings 调用协议，不读取旧的 `api-profiles.json`，也不会覆盖全局 `~/.claude/settings.json`。

参与者选择会通过共享健康探测校验 profile。`status=ok` 只在 5 小时 TTL 内复用，过期会重新 ping；首轮参与者失败时，控制器会尝试启用候补 profile。健康筛选后可用账号少于 2 个，或首轮结束后有效参与者少于 2 个时，脚本会中断并写入 `insufficient_participants`，此时不适合继续多账号讨论。

适合用于：

- 多模型/多账号讨论方案取舍；
- 架构计划、重构计划、风险清单的交叉审查；
- 在执行前获取 P0-P4 问题分级和用户确认点；
- 需要保留讨论 transcript 供 Codex 审查的任务。

默认运行记录写入当前工作目录的 `roundtable-runs/`，该目录只用于本地复盘，不提交到仓库。模型讨论结果不替代 Codex 验收，最终计划文档也不是无条件生成。

讨论分两种模式：

| 模式 | 适用情况 | 工具边界 |
| --- | --- | --- |
| 纯文本讨论 | 题面已经提供完整事实 | 默认 `--tools ""`，模型不能读取文件，也不能输出 `<tool_call>` 伪工具标签。 |
| 受限只读讨论 | 需要核对仓库事实 | 使用 `--read-scope <path>`，只开放 `Read,Glob,Grep`，禁止修改、执行命令和无目的全仓扫描。 |

受限只读示例：

```powershell
node <skill-dir>\scripts\roundtable.js `
  --topic-file .\topic.md `
  --codex-brief-file .\codex-brief.md `
  --profiles all `
  --max-participants 2 `
  --read-scope .\src\views\HomeView.vue `
  --read-scope .\e2e\login.spec.ts
```

`--read-scope` 是讨论读取边界说明，不是系统级沙箱；Codex 最终仍要复核 transcript 和本地事实。

### 脚本结构说明

`claude-roundtable` 的脚本由共享 profile 工具和 roundtable 独有控制器两部分组成：

| 路径 | 类型 | 说明 |
| --- | --- | --- |
| `scripts/switch-api.js`、`scripts/lib/` | 共享部分 | 复用 profile 保存、读取、健康探测和独立 settings 调用能力。以 `claude-orchestrator` 中的同路径文件为主版本，修改时先改主版本，再同步到 `claude-roundtable`。 |
| `scripts/roundtable.js`、`scripts/roundtable-lib/` | 独有部分 | 负责多 profile 参与者选择、结构化讨论、定向消息路由、轮数限制和 transcript 写入，只在 `claude-roundtable` 中维护。 |

共享部分和独有部分的完整维护纪律见 [shared-skills.md](AGENTSDOC/rules/global/shared-skills.md) 与 [claude-roundtable 脚本模块规则](AGENTSDOC/rules/claude-roundtable/scripts.md)。

`claude-roundtable` 可以单独下载使用，不要求同时安装 `claude-orchestrator`。完整使用说明见 [usage.md](skills/claude-roundtable/references/usage.md)，profile 管理说明见 [profile-management.md](skills/claude-roundtable/references/profile-management.md)。

## 维护建议

- 本项目协作入口维护在 [AGENTS.md](AGENTS.md)，负责项目专属元规则、渐进披露索引和阅读路径，不重复通用规则。
- 通用协作模板维护在 [AGENTS-template.md](AGENTS-template.md)；跨项目规则变化优先同步到该文件。
- 本项目专属细则维护在 [AGENTSDOC/rules/](AGENTSDOC/rules/)；新增或调整细则时，同步更新 [AGENTS.md](AGENTS.md) 的规则索引。
- 过程文档一律放到 `AGENTSDOC/plans/<模块>/`，不在仓库根目录扩散，也不入库。
- Skill 的详细规则维护在各自的 `SKILL.md` 中，例如 [daily-log-sync/SKILL.md](skills/daily-log-sync/SKILL.md) 和 [claude-orchestrator/SKILL.md](skills/claude-orchestrator/SKILL.md)。
- 多 profile 讨论能力维护在 [claude-roundtable/SKILL.md](skills/claude-roundtable/SKILL.md)，最终结论仍由 Codex 裁决。
- 改动共享 profile 脚本或脚本对 `~/.claude/profiles/` 的读写协议时，先读取 [shared-skills.md](AGENTSDOC/rules/global/shared-skills.md)。
- 修改 `skills/*/scripts/` 下脚本的用户可见输出时，先读取 [skill-script-i18n.md](AGENTSDOC/rules/global/skill-script-i18n.md)。
