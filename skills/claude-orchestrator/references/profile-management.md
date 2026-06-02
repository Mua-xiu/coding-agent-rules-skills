# Claude Orchestrator Profile 管理说明

此文档说明 `claude-orchestrator` 如何保存和独立调用 Claude Code 的账号/provider 配置。当前 active skill 使用固定 profile 约定：`architect`、`implementer`、`mechanic`。

这三个名称按任务职责命名，不按具体模型厂商或个人账号命名。用户可以把 Claude、Gemini、DeepSeek、Mimo 或其它 provider 账号保存到对应 profile；Codex 只关心 profile 代表的职责分工。

## Claude Code 版本兼容说明

当前 profile 保存、独立 settings 调用、健康探测和 `global-overwrite` 回退流程，是在 `2.1.146 (Claude Code)` 下开发、测试和验证的。更高或更低版本的 Claude Code 尚未在本仓库中完成验证，可能存在参数、settings 读取方式、权限模式或认证存储位置差异。

用户下载或迁移到其它机器后，可以根据自己的 Claude Code 版本、provider 配置和实际需求，自行调整相关脚本与命令；调整共享 profile 脚本或调用协议时，应同步维护 `SKILL.md`、`references/usage.md`、本文档和仓库规则索引。

## 目录结构

默认 profile 根目录：

```text
~/.claude/profiles/
```

每个 profile 一目录：

```text
~/.claude/profiles/
├── architect/
│   ├── settings.json
│   ├── .claude.json
│   ├── profile-meta.json
│   └── health.json
├── implementer/
└── mechanic/
```

`settings.json` 是必需文件，因为 provider env、模型别名通常在这里。默认模式把 profile 快照作为 `claude --settings` 的调用源，并通过 `--setting-sources project,local` 排除全局 user settings，不覆盖也不依赖 `~/.claude/settings.json`。

`.claude.json` 是旧版全局覆盖回退模式的可选快照。`health.json` 由脚本独占管理，记录最近一次活性探测结果；不要手动修改。

## 固定 profile 约定

| Profile | 建议绑定的账号能力 | 主要职责 |
| --- | --- | --- |
| `architect` | 推理、架构判断、风险识别能力最强的账号，例如 Claude、Gemini 或其它高能力模型账号 | 需求澄清、方案设计、任务拆解、前置风险识别、只读风险/安全/认证/数据审查、可选 diff 初审。 |
| `implementer` | 执行稳定、成本适中、适合持续改代码的账号，例如 DeepSeek 或其它代码执行型账号 | 明确边界后的功能实现、代码清理、测试补齐、文档补充、结构化跟进。 |
| `mechanic` | 成本低、速度快、适合重复整理的账号，例如 Mimo 或其它轻量账号 | 同时满足三条标准的机械任务：明确替换、格式化、模板填充、跨文件同步。 |

当前 active skill 不维护 `profile-roles.json`，也不尝试通过脚本强制拦截 Codex 的 skill 调用。Codex 只按上述固定约定选择 profile。

如果暂时只有一个可用模型账号，可以把 `architect`、`implementer`、`mechanic` 都保存为同一个实际账号。保留三个 profile 名称的好处是分工规则稳定，后续替换某一档能力账号时不需要修改 skill。

默认不建议改 profile 名称；如果确实改名，必须同步修改 `SKILL.md`、`references/usage.md`、本文档和命令示例。

## Profile 缺失与兜底

如果没有任何 profile，Codex 会提示用户先按 `references/usage.md` 和本文档保存账号；用户没有立即配置或当前任务仍需继续时，Codex 直接兜底完成任务。

如果目标职责 profile 缺失或缺少 `settings.json`，Codex 不会自动改派给其它职责 profile。例如 `implementer` 缺失时，不让 `architect` 临时代写实现；除非用户明确要求重新绑定 profile 或临时改用某个账号。

如果目标 profile 存在但失活，Codex 最多执行普通 `--ping <profile>` 和一次 `--ping <profile> --force`。仍失败时停止委派，由 Codex 接管分配给该失活账号的任务。

## 命令清单

| 命令 | 作用 |
| --- | --- |
| `node "$SkillDir\scripts\switch-api.js" --init-current architect` | 把当前 Claude live 配置保存为 `architect` profile。 |
| `node "$SkillDir\scripts\switch-api.js" --init-current implementer` | 把当前 Claude live 配置保存为 `implementer` profile。 |
| `node "$SkillDir\scripts\switch-api.js" --init-current mechanic` | 把当前 Claude live 配置保存为 `mechanic` profile。 |
| `node "$SkillDir\scripts\switch-api.js" --settings-path implementer` | 只输出 `implementer` 的 settings 路径。 |
| `node "$SkillDir\scripts\switch-api.js" --ping implementer` | 探测或复用 `implementer` 健康状态。 |
| `node "$SkillDir\scripts\switch-api.js" --ping implementer --force` | 强制刷新 `implementer` 健康状态。 |
| `node "$SkillDir\scripts\switch-api.js" --ping-all` | 检查全部 profile，允许复用 TTL 内成功状态。 |
| `node "$SkillDir\scripts\switch-api.js" --refresh-health` | 强制刷新全部 profile。 |
| `node "$SkillDir\scripts\switch-api.js" --list` | 列出所有 profile、模型摘要和健康状态。 |
| `node "$SkillDir\scripts\switch-api.js" --status` | 查看默认模式、旧覆盖 active profile 和 live 配置摘要，token 会被遮蔽。 |
| `node "$SkillDir\scripts\switch-api.js" implementer --mode global-overwrite --dry-run` | 预览旧版覆盖行为，不实际复制文件。 |
| `node "$SkillDir\scripts\switch-api.js" implementer --mode global-overwrite` | 备份并覆盖全局 Claude 配置，仅用于回退。 |
| `node "$SkillDir\scripts\switch-api.js" --profiles-root "D:\profiles" --list` | 使用自定义 profile 根目录。 |

## 创建 profile

1. 先手动让 Claude Code 处在某个适合目标职责的账号/provider 下。
2. 确认 Claude Code 可用：

```powershell
claude --version
```

3. 如果当前账号适合高判断成本任务，保存为：

```powershell
node "$SkillDir\scripts\switch-api.js" --init-current architect
```

4. 切到适合中等复杂度执行、低风险机械整理的账号/provider 后，再分别保存：

```powershell
node "$SkillDir\scripts\switch-api.js" --init-current implementer
node "$SkillDir\scripts\switch-api.js" --init-current mechanic
```

覆盖已有 profile 时才使用：

```powershell
node "$SkillDir\scripts\switch-api.js" --init-current implementer --force
```

## 独立调用 profile

默认调用：

```powershell
$SettingsPath = node "$SkillDir\scripts\switch-api.js" --settings-path implementer
claude --settings "$SettingsPath" --setting-sources project,local
```

默认模式不会修改 `~/.claude/settings.json`。`--setting-sources project,local` 用于避免当前全局 user settings 影响独立 profile。若某个特殊账号/provider 无法通过独立 settings 运行，才使用旧版全局覆盖回退：

```powershell
node "$SkillDir\scripts\switch-api.js" implementer --mode global-overwrite
```

## 备份位置

只有显式使用 `--mode global-overwrite` 时，脚本才会把当前 live 配置备份到：

```text
~/.claude/profile-switch-backups/
```

旧版覆盖状态记录在：

```text
~/.claude/active-profile.json
```

## 查看状态

```powershell
node "$SkillDir\scripts\switch-api.js" --list
node "$SkillDir\scripts\switch-api.js" --status
```

`--status` 会遮蔽 token 字段，不应输出完整密钥。`active-profile.json` 只表示最近一次旧版全局覆盖操作，不表示默认独立 settings 调用已经修改全局配置。

## 健康状态

每个 profile 的活性探测结果保存在：

```text
~/.claude/profiles/<profile>/health.json
```

至少包含：

- `status`
- `last_ping_at`
- `latency_ms`
- `model`
- `error_code`
- `error_message_raw`
- `error_message_zh`
- `consecutive_failures`

脚本使用临时文件和 rename 原子替换 `health.json`。`status=ok` 在 5 小时 TTL 内可以复用；`status=down` 不受 TTL 保护，下一次 `--ping` 会重新探测。实际调用失败后，使用 `--ping <profile> --force` 强制刷新。

注意：`--settings-path` 不会自动执行健康探测，它只是为了方便拼接独立 Claude 命令而输出路径。Codex 委派前必须先运行 `--ping <profile>`，再读取 settings 路径。

## Claude Code 版本变化时

Claude Code 可能调整认证或 provider 配置的存储位置。如果切换后账号状态不对：

1. 手动登录或切换一次 Claude Code。
2. 先用 `claude --settings <profile-settings> --setting-sources project,local` 执行轻量 prompt，确认独立调用是否仍然有效。
3. 如果确实只能依赖其它 live 配置，再对比用户目录下哪些 Claude 配置文件发生变化。
4. 只把旧版回退确实需要管理的文件加入 `scripts/lib/constants.js` 的 `MANAGED_FILES`。
5. profile 快照仍然只保存到 `~/.claude/profiles/`，不要提交到 git。
6. 执行小任务验证账号确实可用。

## 安全规则

- 不提交 `~/.claude/profiles`。
- 不在日志、issue、最终回复中粘贴完整 token。
- profile 名称只使用 `architect`、`implementer`、`mechanic` 这类普通标识，不把密钥写进名称。
- 确认新 profile 可用前，不要清理 `profile-switch-backups`。
