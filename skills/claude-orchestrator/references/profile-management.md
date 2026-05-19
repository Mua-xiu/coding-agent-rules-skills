# Claude Profile 管理说明

此文档说明 `claude-orchestrator` 如何保存和切换 Claude Code 的账号/provider 配置。当前 active skill 使用固定 profile 约定：`xhxGPT`、`deepseek`、`mimo`。

## 先定义通用路径

所有命令都建议先定义 `$SkillDir`，这样可以从任意 PowerShell 当前目录执行：

```powershell
$CodexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME ".codex" }
$SkillDir = Join-Path $CodexHome "skills\claude-orchestrator"
```

如果只是在本仓库中调试，使用：

```powershell
$SkillDir = "C:\Users\lin\Desktop\project\Agent\coding-agent-rules-skills\skills\claude-orchestrator"
```

## 存储模型

不要把 profile 文件放进本仓库。Claude Code 的账号/provider 配置可能包含 token。

默认 profile 根目录：

```text
~/.claude/profiles/<profile>/
```

当前脚本管理的 live 配置：

```text
~/.claude/settings.json  <-  ~/.claude/profiles/<profile>/settings.json
~/.claude.json           <-  ~/.claude/profiles/<profile>/.claude.json
```

`settings.json` 是必需文件，因为 provider env、模型别名通常在这里；`.claude.json` 是可选文件，因为不同 Claude Code 版本或登录方式可能会在这里保存账号/会话信息。

## 固定 profile 约定

| Profile | 主要职责 |
| --- | --- |
| `xhxGPT` | 高判断成本任务：架构审查、风险删除、图/Schema 变更、大范围重构、安全/认证/数据风险审查。 |
| `deepseek` | 中等复杂度执行：功能实现、代码清理、测试补齐、文档补充、结构化跟进。 |
| `mimo` | 低风险机械任务：格式化类修改、模板更新、简单文件移动、重复文本清理。 |

当前 active skill 不维护 `profile-roles.json`，也不尝试通过脚本强制拦截 Codex 的 skill 调用。Codex 只按上述固定约定选择 profile。

## 命令清单

| 命令 | 作用 |
| --- | --- |
| `node "$SkillDir\scripts\switch-api.js" --help` | 查看帮助。 |
| `node "$SkillDir\scripts\switch-api.js" --init-current xhxGPT` | 把当前 Claude live 配置保存为 `xhxGPT` profile。 |
| `node "$SkillDir\scripts\switch-api.js" --init-current deepseek` | 把当前 Claude live 配置保存为 `deepseek` profile。 |
| `node "$SkillDir\scripts\switch-api.js" --init-current mimo` | 把当前 Claude live 配置保存为 `mimo` profile。 |
| `node "$SkillDir\scripts\switch-api.js" xhxGPT` | 切换到 `xhxGPT` profile。 |
| `node "$SkillDir\scripts\switch-api.js" deepseek` | 切换到 `deepseek` profile。 |
| `node "$SkillDir\scripts\switch-api.js" mimo` | 切换到 `mimo` profile。 |
| `node "$SkillDir\scripts\switch-api.js" --list` | 列出所有 profile。 |
| `node "$SkillDir\scripts\switch-api.js" --status` | 查看当前 live 配置摘要，token 会被遮蔽。 |
| `node "$SkillDir\scripts\switch-api.js" deepseek --dry-run` | 预览切换行为，不实际复制文件。 |
| `node "$SkillDir\scripts\switch-api.js" deepseek --no-backup` | 切换 profile 但不备份当前 live 配置。 |
| `node "$SkillDir\scripts\switch-api.js" --profiles-root "D:\profiles" --list` | 使用自定义 profile 根目录。 |

## 创建 profile

1. 先手动让 Claude Code 处在某个账号/provider 下。
2. 确认 Claude Code 可用：

```powershell
claude --version
```

3. 保存当前 live 配置：

```powershell
node "$SkillDir\scripts\switch-api.js" --init-current xhxGPT
```

4. 切到另一个账号/provider 后，再保存：

```powershell
node "$SkillDir\scripts\switch-api.js" --init-current deepseek
node "$SkillDir\scripts\switch-api.js" --init-current mimo
```

覆盖已有 profile 时才使用：

```powershell
node "$SkillDir\scripts\switch-api.js" --init-current deepseek --force
```

## 切换 profile

手动切换：

```powershell
node "$SkillDir\scripts\switch-api.js" xhxGPT
node "$SkillDir\scripts\switch-api.js" deepseek
node "$SkillDir\scripts\switch-api.js" mimo
```

如果旧流程依赖 `node ~/.claude/switch-api.js <profile>`，可以把脚本复制到 Claude 用户目录：

```powershell
Copy-Item -Force "$SkillDir\scripts\switch-api.js" "$HOME\.claude\switch-api.js"
node ~/.claude/switch-api.js deepseek
```

## 备份位置

每次切换前，脚本会把当前 live 配置备份到：

```text
~/.claude/profile-switch-backups/
```

切换状态记录在：

```text
~/.claude/active-profile.json
```

## 查看状态

```powershell
node "$SkillDir\scripts\switch-api.js" --list
node "$SkillDir\scripts\switch-api.js" --status
```

`--status` 会遮蔽 token 字段，不应输出完整密钥。

## Claude Code 版本变化时

Claude Code 可能调整认证或 provider 配置的存储位置。如果切换后账号状态不对：

1. 手动登录或切换一次 Claude Code。
2. 对比用户目录下哪些 Claude 配置文件发生变化。
3. 只把确实需要管理的文件加入 `scripts/switch-api.js` 的 `MANAGED_FILES`。
4. profile 快照仍然只保存到 `~/.claude/profiles/`，不要提交到 git。
5. 执行小任务验证账号确实切换成功。

## 安全规则

- 不提交 `~/.claude/profiles`。
- 不在日志、issue、最终回复中粘贴完整 token。
- profile 名称只使用 `xhxGPT`、`deepseek`、`mimo` 这类普通标识，不把密钥写进名称。
- 确认新 profile 可用前，不要清理 `profile-switch-backups`。
