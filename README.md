# Coding Agent Rules & Skills

这个仓库用于集中维护个人常用的 Coding Agent 协作规则和 Claude Code skills，方便同步到 GitHub 后在不同项目、不同机器、不同 coding 工具中复用。

## 目录结构

```text
.
├── AGENTS.md                         # Codex 等支持 AGENTS.md 的 coding agent 通用规则模板
└── skills/
    └── daily-log-sync/               # Claude Code 日志同步 skill
        ├── SKILL.md
        ├── README.md
        ├── reference.md
        ├── template.md
        ├── LICENSE
        └── examples/
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
