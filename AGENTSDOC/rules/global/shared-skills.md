# 多 Skill 共享脚本与状态读写协议纪律

当任务改动共享脚本，或影响多个 skill 对同一份本地状态目录的读写协议时，必须先读取本文件。仓库任务不直接修改用户目录 `~/.claude/profiles/<profile>/` 中的真实 profile 数据；该目录由用户运行脚本时生成或更新。

## 触发范围

- 改动 `skills/claude-orchestrator/scripts/switch-api.js` 或 `skills/claude-orchestrator/scripts/lib/`。
- 改动 `skills/claude-roundtable/scripts/switch-api.js` 或同 skill 下共享 `scripts/lib/`，如果该路径在当前仓库或本地 skill 集中存在。
- 修改脚本对 `~/.claude/profiles/<profile>/` 的路径约定、文件结构、读写协议、健康状态记录或共享数据字段定义。
- 修改任何会影响多个 skill 复用同一 profile 存储模型的说明文档或脚本行为。

## 通用纪律

- 每一组共享关系必须显式登记，登记内容包括脚本运行时状态目录或读写协议、主版本脚本路径、从版本脚本路径，以及同步纪律。
- 共享脚本采用“一主一从”模式：明确指定一份主版本脚本，其它脚本均为从版本，必须与主版本保持一致。
- 改动顺序必须是先修改主版本，再把改动同步到所有从版本，并在改动说明中显式列出已同步的文件。
- 不允许只改主版本而不同步从版本，也不允许绕过主版本直接修改从版本。
- 共享数据文件由脚本独占管理，用户不应手动修改；如确有修改需要，应先升级脚本能力，而不是直接编辑共享文件。
- 脚本写入共享数据文件时可以采用整体覆盖式写入，简化实现，避免为了保留未知字段引入额外复杂度；如果未来确实需要兼容未知字段，应先说明风险并征得确认。

## 现有共享组登记

### `claude-orchestrator` + `claude-roundtable`

- 脚本运行时共享状态目录：`~/.claude/profiles/<profile>/`，用于保存每个 profile 的 Claude settings、附属配置以及健康状态；仓库任务不直接编辑该用户目录中的真实数据。
- 主版本脚本：`skills/claude-orchestrator/scripts/switch-api.js`。
- 从版本脚本：`skills/claude-roundtable/scripts/switch-api.js`。
- 主版本内部模块：`skills/claude-orchestrator/scripts/lib/`。
- 从版本内部模块：`skills/claude-roundtable/scripts/lib/`（如该路径存在）。
- 当前仓库如果暂未包含 `claude-roundtable` 路径，不需要凭空创建；后续接入该 skill 或在本地存在同名路径时，必须按从版本脚本同步。
- 同步纪律：先修改主版本，再同步到从版本；不允许只改其中一份。两份脚本对共享状态目录的读写协议必须保持一致。

#### 当前共享状态协议

- `settings.json`：profile 的 Claude settings 快照。默认调用方式是 `claude --settings ~/.claude/profiles/<profile>/settings.json --setting-sources project,local`，不覆盖也不叠加读取用户全局 `~/.claude/settings.json`。
- `.claude.json`：可选附属快照，只在确有兼容需要或显式使用旧版 `global-overwrite` 回退模式时读取。
- `profile-meta.json`：脚本保存 profile 时写入的来源和文件摘要。
- `health.json`：脚本独占管理的账号活性状态。写入时必须使用临时文件和 rename 原子替换，避免并发读取到半写入内容。
- `global-overwrite`：仅作为独立 settings 无法承载特定账号/provider 状态时的显式回退模式；使用前必须备份 live 配置，不得作为默认流程。

`health.json` 至少包含以下字段：

- `status`
- `last_ping_at`
- `latency_ms`
- `model`
- `error_code`
- `error_message_raw`
- `error_message_zh`
- `consecutive_failures`
