# 0 - claude-orchestrator 脚本底座优化执行计划

## 目标

先在现有 `claude-orchestrator` 中实现独立 Claude CLI 调用底座：使用 `~/.claude/profiles/<profile>/settings.json` 作为 `claude --settings` 参数运行，不再默认覆盖全局 `~/.claude/settings.json`。

本阶段只处理共享脚本能力、健康探测和现有 skill 文档更新，不实现新的多模型讨论 skill。

## 必读规则

- `AGENTS.md`
- `AGENTSDOC/rules/global/shared-skills.md`
- `AGENTSDOC/rules/global/skill-script-i18n.md`

原因：本阶段会修改 `skills/claude-orchestrator/scripts/switch-api.js`，属于共享脚本主版本；未来接入 `claude-roundtable` 或新 skill 时，需要同步同一套读写协议。

## 执行范围

允许修改：

- `skills/claude-orchestrator/scripts/switch-api.js`
- `skills/claude-orchestrator/SKILL.md`
- `skills/claude-orchestrator/references/usage.md`
- `skills/claude-orchestrator/references/profile-management.md`
- 必要时补充 `skills/claude-orchestrator/agents/openai.yaml`

禁止默认修改：

- 用户目录下真实 `~/.claude/profiles/` 数据。
- 全局 `~/.claude/settings.json`。
- 未来新 skill 文件。

## 执行步骤

1. 验证 `claude --settings <profile-settings>` 可用性。
   - 使用已有 profile 的 `settings.json` 做只读 ping。
   - 验证不会覆盖全局 `~/.claude/settings.json`。
   - 如果 `--settings` 无法完整承载账号/provider 状态，停止实现并记录阻塞。

2. 扩展 `switch-api.js` 参数。
   - 新增 `--mode profile-settings`，作为默认模式。
   - 保留 `--mode global-overwrite` 作为旧行为回退。
   - 保留现有 `--init-current`、`--list`、`--status`。
   - 新增 `--settings-path <profile>` 或等价能力，用于输出 profile settings 路径，方便调用方拼接 `claude --settings`。

3. 实现健康探测。
   - 新增 `--ping <profile>`。
   - 新增 `--ping-all`。
   - 新增 `--refresh-health` 作为别名。
   - 使用轻量 prompt：`Reply with the single word: ok`。
   - 默认探测超时约 30 秒，首次保存后探测可放宽到 60 秒。

4. 写入 `health.json`。
   - 每个 profile 一份：`~/.claude/profiles/<profile>/health.json`。
   - 使用临时文件写入 + rename，避免并发半写入。
   - 字段至少包含：`status`、`last_ping_at`、`latency_ms`、`model`、`error_code`、`error_message_raw`、`error_message_zh`、`consecutive_failures`。

5. 设计 TTL 与失败重测。
   - `status=ok` 且未超过 TTL 时可复用。
   - `status=down` 每次任务开始都允许重测。
   - 实际调用失败时强制刷新当前 profile 的健康状态。

6. 更新 `--init-current` 流程。
   - 保存当前 live 配置为 profile 后，立即 ping 一次。
   - 成功写 `health.json.status=ok`。
   - 失败写 `status=down` 和错误信息，并用中英双语提示用户。

7. 更新现有 skill 文档。
   - `SKILL.md`：说明默认不再覆盖全局 settings。
   - `usage.md`：更新调用示例为 `claude --settings <profile-settings>`。
   - `profile-management.md`：说明 profile settings 快照是调用源，用户目录数据不入库。

8. 验证旧模式回退。
   - `--mode global-overwrite` 仍能执行旧复制覆盖流程。
   - 回退模式必须明确提示会修改全局 Claude settings。

## 验收标准

- 默认模式不会修改 `~/.claude/settings.json`。
- 能输出或使用 `~/.claude/profiles/<profile>/settings.json` 运行 Claude CLI。
- `--ping <profile>` 能生成或更新 `health.json`。
- `health.json` 写入采用原子写入。
- `--init-current <profile>` 后会执行一次健康探测。
- 旧 `global-overwrite` 模式仍可显式使用。
- 所有用户可见脚本输出遵守中英双语提示规范。
- 文档中的示例不再默认使用全局覆盖方式。

## 暂不处理

- 不实现多模型会议控制器。
- 不实现模型间消息路由。
- 不生成 P0-P4 计划文档。
- 不迁移或兼容旧 `api-profiles.json`。
- 不创建 `claude-roundtable` 或新 skill 文件。
