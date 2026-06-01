# claude-orchestrator 脚本模块规则

当任务修改 `skills/claude-orchestrator/scripts/` 下的 CLI 入口、`scripts/lib/` 模块、profile 调用协议、健康探测或旧版全局覆盖回退逻辑时，必须先读取本文件。

## 目录职责

- `scripts/switch-api.js`：CLI 薄入口，只负责解析后的命令分发，不继续堆叠业务实现。
- `scripts/lib/constants.js`：路径、模式、文件名、TTL、隔离调用参数和旧版回退管理文件清单。
- `scripts/lib/args.js`：命令行参数解析、参数值校验和单主操作约束。
- `scripts/lib/fs-json.js`：路径展开、目录创建、JSON 读写和原子写入。
- `scripts/lib/profile-store.js`：profile 路径、名称校验、settings 摘要、列表、状态展示和独立 settings 路径输出。
- `scripts/lib/health.js`：Claude CLI 健康探测、`health.json` 写入、TTL 复用和失败计数。
- `scripts/lib/profile-init.js`：`--init-current` 保存当前 live 配置，并触发首次健康探测。
- `scripts/lib/global-overwrite.js`：旧版 `global-overwrite` 回退、live 配置备份和覆盖逻辑。
- `scripts/lib/output.js`：用户可见错误和帮助文本输出。

## 维护纪律

- 保持 `switch-api.js` 为薄入口；新增能力应优先放入职责匹配的 `scripts/lib/*.js` 模块。
- 不要把 profile 存储、健康探测、全局覆盖和参数解析重新混回同一个文件。
- 默认独立调用 Claude 必须使用 `--settings <profile-settings> --setting-sources project,local`，避免叠加读取全局 user settings。
- `health.json` 只能由脚本管理，写入必须使用临时文件和 rename 原子替换。
- `global-overwrite` 只能作为显式回退模式，不得成为默认流程。
- 用户可见脚本输出继续遵守 `AGENTSDOC/rules/global/skill-script-i18n.md` 的中英双语规范。
- 修改仓库版 skill 后，如需在当前机器上实测，必须同步到 `~/.codex/skills/claude-orchestrator`，并在反馈中说明是否已同步。
- 如果未来接入 `claude-roundtable` 从版本脚本，必须按 `AGENTSDOC/rules/global/shared-skills.md` 同步同一套 `scripts/lib/` 协议。

## 验证要求

- 至少运行 `node --check` 覆盖 `scripts/switch-api.js` 和 `scripts/lib/*.js`。
- 至少验证 `--help`、`--settings-path <profile>`、`--list`。
- 涉及健康探测时，验证 `--ping <profile>` 不会修改全局 `~/.claude/settings.json`。
- 涉及 `global-overwrite` 时，必须在隔离 HOME 或完整备份/恢复流程中验证，不要直接破坏用户当前全局配置。
