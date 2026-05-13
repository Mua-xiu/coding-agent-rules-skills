# daily-log-sync-skill

这是一个面向 Claude Code 的原生 skill 目录，用于维护“同一天的同一份工作日志”。

## 复制方式

你后续可以把整个目录复制到：

```text
C:\Users\kin\.claude\skills\daily-log-sync\
```

Claude Code 识别的关键文件是：

- `SKILL.md`

## 当前保留文件

- `SKILL.md`：Claude Code 原生 skill 入口
- `reference.md`：详细规则与约束
- `template.md`：日志模板
- `examples/example-input.md`：输入示例
- `examples/example-output.md`：输出示例

## skill 目标

- 同一天只维护一份主日志
- 已有日志优先读取并增量更新
- 正文写清问题现象、排查分析、最终正确分析、最终修改方案、最终结果
- 如果实际存在误判方向、候选方向或风险取舍，再补充对应章节，不强行固定“怀疑方向”标题
- 未完成问题统一维护在文末“待后续完善问题”
- 避免日志退化成文件列表或命令流水账

## 使用说明

当你把它移植到 Claude Code 的 skills 目录后，Claude Code 会根据 `SKILL.md` 识别它。

它同时兼容两种触发方式。

### 方式 1：slash command

```text
/daily-log-sync
```

也可以补充一句自然语言说明：

```text
/daily-log-sync 总结今天的分析和问题，并更新今天的日志
```

如果你什么额外说明都不写，只输入 `/daily-log-sync`，这个 skill 也应默认按“维护当天日志”的目标执行。

### 方式 2：直接发自然语言

```text
总结今天的分析和问题
```

或：

```text
更新今天的日志，把未完成问题也补上
```

这两种方式应该命中同一套规则，而不是一套走 slash command、一套退化成普通聊天总结。
