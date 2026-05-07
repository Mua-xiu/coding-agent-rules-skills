# Coding Agent Rules & Skills

这个仓库用于集中维护个人常用的 Coding Agent 协作规则和 Claude Code skills，方便同步到 GitHub 后在不同项目、不同机器、不同 coding 工具中复用。

## 目录结构

```text
.
├── AGENTS.md                         # 跨 coding agent 的通用协作规则
├── CLAUDE.md                         # Claude Code 专用入口，引用 AGENTS.md
├── .github/
│   └── copilot-instructions.md       # GitHub Copilot 专用入口，引用 AGENTS.md
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

[AGENTS.md](AGENTS.md) 是推荐维护的主规则文件，适合放跨工具通用的协作习惯，例如：

- 使用中文回答和解释；
- 优先推荐改动最小但有效可靠的方案；
- 修改代码时保持中文注释习惯；
- 不确定旧代码是否删除时先询问；
- `/daily-log-sync` 日志同步规则入口。

后续如果规则需要调整，优先修改 [AGENTS.md](AGENTS.md)。

### CLAUDE.md

[CLAUDE.md](CLAUDE.md) 是 Claude Code 更容易自动识别的项目规则入口。本仓库中它只引用 [AGENTS.md](AGENTS.md)，避免维护两份重复规则。

### .github/copilot-instructions.md

[.github/copilot-instructions.md](.github/copilot-instructions.md) 是 GitHub Copilot 的常见规则入口。本仓库中它同样引用 [AGENTS.md](AGENTS.md)。

## daily-log-sync skill

[daily-log-sync](skills/daily-log-sync/) 用于维护当天工程复盘日志。

它的目标不是生成浅层日报，而是把当天实际分析、排查、修改和最终结论整理成可复盘的工程日志。

适合记录：

- 问题现象；
- 初步排查中一度怀疑的方向；
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

推荐把以下文件复制到目标项目根目录：

```text
AGENTS.md
CLAUDE.md
.github/copilot-instructions.md
```

如果只使用 Claude Code，也可以只复制：

```text
AGENTS.md
CLAUDE.md
```

如果只希望通用规则生效，可以只复制：

```text
AGENTS.md
```

## 维护建议

- 通用协作规则统一维护在 [AGENTS.md](AGENTS.md)。
- Claude Code 专用补充写在 [CLAUDE.md](CLAUDE.md)，但不要重复大段规则。
- Copilot 专用补充写在 [.github/copilot-instructions.md](.github/copilot-instructions.md)，但也尽量引用 [AGENTS.md](AGENTS.md)。
- Skill 的详细规则维护在 [skills/daily-log-sync/SKILL.md](skills/daily-log-sync/SKILL.md)。
