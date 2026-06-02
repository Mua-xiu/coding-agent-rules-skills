# Claude Roundtable Profile 管理说明

## 独立性说明

`claude-roundtable` 可以单独下载和安装。虽然它与 `claude-orchestrator` 使用同一种 `~/.claude/profiles/<profile>/` 存储协议，但本 skill 自带完整的 `switch-api.js` 和共享 profile 脚本，不需要依赖另一个 skill 才能配置账号。

## 存储位置

默认 profile 根目录：

```text
~/.claude/profiles/<profile>/
```

每个 profile 可能包含：

| 文件 | 是否必需 | 说明 |
| --- | --- | --- |
| `settings.json` | 必需 | Claude Code settings 快照，独立调用时通过 `--settings` 使用。 |
| `.claude.json` | 可选 | 兼容旧版或特殊 provider 状态的附属快照。 |
| `profile-meta.json` | 自动生成 | 记录创建时间、复制的文件和安全提示。 |
| `health.json` | 自动生成 | 健康探测结果、模型摘要、错误信息和连续失败次数。 |

这些文件可能包含 token 或 provider 凭据，只应保存在用户目录，不要提交到仓库。

## 创建或覆盖 profile

1. 先在 Claude Code 中手动切到目标账号/provider。
2. 运行保存命令：

```powershell
$CodexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME ".codex" }
$SkillDir = Join-Path $CodexHome "skills\claude-roundtable"

node "$SkillDir\scripts\switch-api.js" --init-current architect
```

覆盖已有 profile 时加 `--force`：

```powershell
node "$SkillDir\scripts\switch-api.js" --init-current architect --force
```

保存后脚本会立即运行一次健康探测。探测失败不代表保存失败，但后续讨论会把该 profile 视为不可用或降级风险。

## Profile 命名

推荐使用职责名称：

- `architect`
- `implementer`
- `mechanic`

不要默认改成厂商名或个人账号名。roundtable 的参与者选择、候补和 transcript 都以这些名称表达职责。若确实要改名，需要同步更新讨论命令、说明文档和团队约定。

同一个实际账号可以保存为多个 profile。这样在暂时只有一个账号时仍能测试流程，后续替换某个职责账号时不需要改规则。

## 健康状态

查看状态：

```powershell
node "$SkillDir\scripts\switch-api.js" --list
node "$SkillDir\scripts\switch-api.js" --status
```

探测单个 profile：

```powershell
node "$SkillDir\scripts\switch-api.js" --ping architect
node "$SkillDir\scripts\switch-api.js" --ping architect --force
```

刷新全部 profile：

```powershell
node "$SkillDir\scripts\switch-api.js" --refresh-health
```

健康缓存规则：

- `status=ok` 默认复用 5 小时。
- 超过 TTL 后，真实 roundtable 运行会重新 ping。
- `status=down` 不受 TTL 保护，下一次 `--ping` 会重新探测。
- 实际讨论调用失败后，控制器会强制刷新该 profile 健康状态，避免继续复用旧的 ok。

`health.json` 至少包含：

```json
{
  "status": "ok",
  "last_ping_at": "2026-06-02T00:00:00.000Z",
  "latency_ms": 3000,
  "model": "model-name",
  "error_code": null,
  "error_message_raw": null,
  "error_message_zh": null,
  "consecutive_failures": 0
}
```

## 独立 settings 调用

获取 settings 路径：

```powershell
$SettingsPath = node "$SkillDir\scripts\switch-api.js" --settings-path architect
```

真实调用 Claude 时必须配合：

```powershell
claude --settings "$SettingsPath" --setting-sources project,local
```

`--setting-sources project,local` 用于排除当前全局 user settings，避免污染独立 profile 调用。

## 旧版 global-overwrite 回退

默认不使用 `global-overwrite`。只有独立 `--settings` 不能承载某些特殊账号/provider 状态时，才显式回退：

```powershell
node "$SkillDir\scripts\switch-api.js" architect --mode global-overwrite --dry-run
node "$SkillDir\scripts\switch-api.js" architect --mode global-overwrite
```

该模式会覆盖全局 Claude 配置，脚本会先备份到：

```text
~/.claude/profile-switch-backups/
```

日常 roundtable 不应使用这个模式。

## 自定义 profile 根目录

如需把 profile 放在其它目录：

```powershell
node "$SkillDir\scripts\switch-api.js" --profiles-root "D:\claude-profiles" --list
node "$SkillDir\scripts\roundtable.js" --profiles-root "D:\claude-profiles" --topic "..."
```

使用自定义目录时，保存、测活和运行讨论都要传同一个 `--profiles-root`。

## 安全要求

- 不提交 `~/.claude/profiles/`、`settings.json`、`.claude.json`、`health.json` 或备份目录。
- 不把 token、API key、provider secret 粘到 topic、transcript、计划或最终回复。
- 只在排障时读取必要错误片段；不要把完整 settings 或完整日志贴给模型。
- 如需清理讨论记录，可以删除项目中的 `roundtable-runs/`，不要删除 profile 目录，除非确认不再使用对应账号。
