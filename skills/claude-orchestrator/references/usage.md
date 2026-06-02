# Claude Orchestrator 使用说明

## 工作模式

此 skill 的目标不是让用户直接操作 Claude Code，而是让 Codex 主导协作：

```text
用户在 Codex 中提出任务
-> Codex 忽略上一轮 Claude 协作记录中的默认角色和旧任务
-> Codex 判断是否适合委派
-> Codex 按固定职责选择 architect / implementer / mechanic
-> Codex 先执行 --ping <profile>，检查目标 profile 是否存在且健康
-> 可委派时，Codex 使用 claude --settings + --setting-sources project,local 启动 Claude
-> Claude 返回 stdout handoff 或按需写入允许范围内的 handoff 文件
-> Codex 检查真实 diff、测试和边界
-> 不合格时最多再委派一次返工
-> 仍不合格、profile 缺失或 profile 失活时，Codex 本地接管
```

建议使用显式入口：

```text
/claude-orchestrator 帮我让 Claude Code 审查当前改动，并由 Codex 最终验收
```

如果当前 Codex 环境使用 `$skill` 形式，则使用：

```text
$claude-orchestrator 帮我让 Claude Code 补齐测试，并由 Codex 审查
```

## Claude Code 版本兼容说明

当前 `claude-orchestrator` 的脚本和命令是在 `2.1.146 (Claude Code)` 下开发、测试和验证的。更高或更低版本的 Claude Code 尚未在本仓库中完成验证，可能存在参数、settings 读取方式、权限模式或认证存储位置差异。

用户下载或迁移到其它机器后，可以根据自己的 Claude Code 版本、provider 配置和实际需求，自行调整相关脚本与命令；调整共享 profile 脚本或调用协议时，应同步维护 `SKILL.md`、本说明文档、`references/profile-management.md` 以及仓库规则索引。

## 固定账号分工

当前版本采用固定 profile 约定，不再要求用户维护 `profile-roles.json`。profile 名称表示任务职责，不表示具体模型厂商或账号名称。

| Profile | 建议绑定的账号能力 | 适合任务 | 不适合任务 |
| --- | --- | --- | --- |
| `architect` | 推理、架构判断、风险识别能力最强的账号，例如 Claude、Gemini 或其它高能力模型账号 | 需求澄清、方案设计、任务拆解、前置风险识别、只读风险/安全/认证/数据审查、可选 diff 初审 | 默认不承担大量代码主实现；不能替代 Codex 最终验收 |
| `implementer` | 执行稳定、成本适中、适合持续改代码的账号，例如 DeepSeek 或其它代码执行型账号 | 明确边界后的功能实现、代码清理、测试补齐、文档补充、结构化跟进 | 自主架构判断、跨越 `Only change` 边界、跳过自验证 |
| `mechanic` | 成本低、速度快、适合重复整理的账号，例如 Mimo 或其它轻量账号 | 同时满足三条标准的机械任务：明确替换、格式化、模板填充、跨文件同步 | 复杂实现、高风险审查、自动生成内容、开放式整理 |

`mechanic` 三条准入标准：不依赖语义判断决定怎么改；错误容易通过 diff/grep/运行发现；有客观对错标准。

如果暂时只有一个可用模型账号，也可以把 `architect`、`implementer`、`mechanic` 都保存为同一个实际账号。这样做仍然有意义：Codex 会按任务职责选择 profile，后续有更合适的账号时，只需要重新保存对应 profile，不需要改 skill 规则。

不建议把 profile 改成具体厂商名或个人账号名，因为 Codex 的分工规则需要稳定名称。如果确实要改名，必须同步修改 `SKILL.md`、本说明文档和所有命令示例。

## 命令运行位置

所有 Node 脚本都建议用 `$SkillDir` 绝对路径运行，这样无论当前 PowerShell 位于哪个目录，都不会把 `skills\...` 误解析到 `C:\Windows\system32`。

已安装到 Codex 后，推荐先定义：

```powershell
$CodexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME ".codex" }
$SkillDir = Join-Path $CodexHome "skills\claude-orchestrator"
```

`$SkillDir` 在同一个 PowerShell 会话中只需要定义一次。后续命令都复用这个变量；关闭并重新打开 PowerShell 后才需要重新定义。

## 初次配置流程

1. 确认 Claude Code 可用：

```powershell
claude --version
```

2. 手动把 Claude Code 切到适合高判断成本任务的账号/provider。

3. 保存当前配置为 `architect`：

```powershell
node "$SkillDir\scripts\switch-api.js" --init-current architect
```

4. 再分别切到适合执行、机械整理的账号/provider 后，重复保存：

```powershell
node "$SkillDir\scripts\switch-api.js" --init-current implementer
node "$SkillDir\scripts\switch-api.js" --init-current mechanic
```

5. 查看已保存的 profile：

```powershell
node "$SkillDir\scripts\switch-api.js" --list
```

6. 检查默认模式、旧版覆盖模式 active profile 和当前 Claude live 配置：

```powershell
node "$SkillDir\scripts\switch-api.js" --status
```

第 5、6 步是可选检查。真正“保存当前账号为 profile”的命令只有 `--init-current <profile>`；保存后脚本会立即执行一次健康探测并写入 `health.json`。`--status` 只是查看当前状态，不会保存、覆盖或切换账号。

## Profile 可用性与兜底

Codex 委派前必须确认目标 profile 可用，但不能跨职责自动改派。

| 情况 | 处理方式 |
| --- | --- |
| 没有任何 profile | 第一次提示用户按本文档和 `profile-management.md` 配置账号；如果用户没有立即配置或任务仍需继续，Codex 直接完成本次任务。 |
| 目标 profile 缺失或缺少 `settings.json` | 不改派给其它 profile；Codex 接管该子任务，并在最终回复中简短说明。 |
| 目标 profile 健康状态缺失或为 `down` | 先 `--ping <profile>`；仍失败再 `--ping <profile> --force`；两次后仍失败则 Codex 接管。 |
| 实际 Claude 调用失败 | 使用 `--ping <profile> --force` 刷新健康状态；仍失败则 Codex 接管。 |

这些兜底规则是为了保持职责边界稳定。例如 `implementer` 缺失时，不让 `architect` 自动替它实现代码；除非用户明确要求临时改用某个 profile。

## 日常委派流程

1. Codex 只根据本次用户请求和当前仓库状态判断是否值得委派，不直接复用上一次 Claude 的角色、任务或 prompt。
2. 按本次任务的实际风险、复杂度和交付物重新选择 `architect`、`implementer` 或 `mechanic`。
3. 检查目标 profile：

```powershell
node "$SkillDir\scripts\switch-api.js" --ping implementer
$SettingsPath = node "$SkillDir\scripts\switch-api.js" --settings-path implementer
```

4. 使用独立 settings 启动 Claude：

```powershell
claude --settings "$SettingsPath" --setting-sources project,local
```

默认流程不会覆盖 `~/.claude/settings.json`。`--setting-sources project,local` 是独立调用的必要参数，用来排除当前全局 user settings；否则 `claude --settings <file>` 仍可能叠加读取全局配置。

`--settings-path` 只负责输出 settings 路径，不会自动测活。Codex 每次委派前必须先运行 `--ping <profile>`；如果实际 Claude 调用失败，再运行 `--ping <profile> --force` 刷新健康状态。

如果某个特殊账号/provider 无法通过独立 settings 正常运行，才使用旧版回退模式：

```powershell
node "$SkillDir\scripts\switch-api.js" implementer --mode global-overwrite
```

该命令会先备份再覆盖全局 Claude 配置，日常委派不要使用。

## 工具策略示例

纯文本任务，禁用工具：

```powershell
claude -p $prompt `
  --settings "$SettingsPath" `
  --setting-sources project,local `
  --output-format text `
  --permission-mode dontAsk `
  --tools ""
```

仓库感知规划或只读审查，限制为只读工具：

```powershell
claude -p $prompt `
  --settings "$SettingsPath" `
  --setting-sources project,local `
  --output-format text `
  --permission-mode dontAsk `
  --tools Read,Glob,Grep `
  --allowedTools Read,Glob,Grep `
  --effort low
```

读取工作目录外资料时，必须补 `--add-dir`：

```powershell
claude -p $prompt `
  --settings "$SettingsPath" `
  --setting-sources project,local `
  --output-format text `
  --permission-mode dontAsk `
  --add-dir "D:\external-reference" `
  --tools Read,Glob,Grep `
  --allowedTools Read,Glob,Grep `
  --effort low
```

代码修改任务按最小必要范围开放工具，并在 prompt 中写清：

```text
You are working in C:\path\to\project.
Code change task. Only modify the allowed files and run the listed validation.

Task:
补齐 user-service 的单元测试。

Constraints:
- Only change: tests/user-service/*
- Do not change: src/user-service/*
- Run: npm test -- user-service

Acceptance assertions / objective checks:
- 正常用户查询应返回 200。
- 用户不存在时应返回 404。

Return:
- Summary of changes
- Files changed
- Validation performed: command, exit code, key output, assertion/check result
- Remaining issues
- Handoff
```

通过 Codex shell 调用时，命令等待时间建议至少 180 秒。如果仍超时，缩小 prompt 范围或拆分任务后再试一次。

## 健康状态

每个 profile 的健康状态保存到：

```text
~/.claude/profiles/<profile>/health.json
```

- `status=ok` 且未超过 5 小时 TTL 时，普通 `--ping` 和 `--ping-all` 会复用最近结果，减少额外模型调用。
- `status=down` 不受 TTL 保护，下一次 `--ping` 会重新探测。
- `--ping <profile> --force` 强制刷新单个 profile。
- `--refresh-health` 强制刷新全部 profile。
- `health.json` 使用临时文件和 rename 原子写入，避免并发读取到半写入内容。

## 命令清单：switch-api.js

| 命令 | 作用 | 常见场景 |
| --- | --- | --- |
| `node "$SkillDir\scripts\switch-api.js" --help` | 查看脚本帮助。 | 不确定参数时先看帮助。 |
| `node "$SkillDir\scripts\switch-api.js" --init-current architect` | 把当前 Claude live 配置保存为 `architect` profile。 | 初次配置或重新保存账号。 |
| `node "$SkillDir\scripts\switch-api.js" --init-current implementer` | 把当前 Claude live 配置保存为 `implementer` profile。 | 初次配置或重新保存账号。 |
| `node "$SkillDir\scripts\switch-api.js" --init-current mechanic` | 把当前 Claude live 配置保存为 `mechanic` profile。 | 初次配置或重新保存账号。 |
| `node "$SkillDir\scripts\switch-api.js" --settings-path implementer` | 只输出 `implementer` 的 settings 路径。 | 拼接 `claude --settings "$SettingsPath" --setting-sources project,local`。 |
| `node "$SkillDir\scripts\switch-api.js" --ping implementer` | 探测或复用 `implementer` 健康状态。 | 委派前确认账号活性。 |
| `node "$SkillDir\scripts\switch-api.js" --ping implementer --force` | 强制重新探测 `implementer`。 | 实际调用失败后刷新状态。 |
| `node "$SkillDir\scripts\switch-api.js" --ping-all` | 检查全部 profile，允许复用 TTL 内成功状态。 | 批量查看账号活性。 |
| `node "$SkillDir\scripts\switch-api.js" --refresh-health` | 强制刷新全部 profile。 | 需要完整重新测活时使用。 |
| `node "$SkillDir\scripts\switch-api.js" --list` | 列出所有 profile、模型摘要和最近健康状态。 | 查看已有账号配置。 |
| `node "$SkillDir\scripts\switch-api.js" --status` | 查看默认模式、旧覆盖 active profile 和 live 配置摘要，token 会被遮蔽。 | 排查当前配置。 |
| `node "$SkillDir\scripts\switch-api.js" implementer --mode global-overwrite --dry-run` | 预览旧版覆盖模式会复制哪些文件。 | 回退前确认路径。 |
| `node "$SkillDir\scripts\switch-api.js" implementer --mode global-overwrite` | 备份并覆盖全局 Claude 配置。 | 仅在独立 settings 无法工作时回退。 |
| `node "$SkillDir\scripts\switch-api.js" --profiles-root "D:\profiles" --list` | 使用自定义 profile 根目录。 | 不想把 profile 放在默认用户目录时。 |

## 账号配置和备份位置

profile 快照默认保存到用户目录：

```text
~/.claude/profiles/<profile>/
```

只有显式使用 `--mode global-overwrite` 时，覆盖前的 live 配置备份才会保存到：

```text
~/.claude/profile-switch-backups/
```

这些目录可能包含 token，不能提交到 git。

## Handoff 规则

纯文本任务、只读任务和普通代码任务默认在 stdout 返回结构化 handoff，不写工作区文件。只有续作、切换 profile、中断恢复或用户明确要求留档时，才写工作区 handoff 文件；写入路径必须纳入 `Only change`。

handoff 至少包含：

- 任务目标
- 已完成内容
- 修改文件或分析范围
- 已运行测试和结果
- 未解决问题
- 下一步建议

## 审查原则

Codex 验收时优先看：

- 真实 diff
- 测试或验证命令
- 是否越界修改
- 是否满足用户目标
- 是否引入明显风险

失败、超时、输出矛盾或高风险任务时，再读取详细日志或 handoff。

## 最终反馈中的调度说明

使用此 skill 后，Codex 的最终回复需要保留正常交付反馈，包括完成内容、改动文件、验证结果、风险或后续建议。Claude 调度说明只是追加信息，用来说明本次是否委派了 Claude，以及不同 profile 分别负责了什么。

推荐格式：

```text
Claude 协作记录：
- architect：负责 xxx 方案/只读审查。
- implementer：负责 xxx 实现或测试。
- mechanic：负责 xxx 机械整理。

Codex 验收：
已检查 diff，并运行 xxx 测试；未发现需要返工的问题。
```

如果没有调用 Claude：

```text
Claude 协作记录：未使用，本次由 Codex 直接完成。
```

如果因 profile 缺失或失活由 Codex 兜底，简短说明原因和接管范围。这段内容应简短，不输出完整 Claude 过程、不输出 token、不替代 Codex 自身的验收结论。

## 文件职责

`SKILL.md`：Codex 触发 skill 后读取的核心规则，负责固定分工、委派、profile 兜底和审查流程。

`scripts/switch-api.js`：CLI 薄入口，只负责把命令分发给 `scripts/lib/` 下的模块。

`scripts/lib/constants.js`：路径、模式、5 小时健康 TTL、隔离调用参数和旧版回退管理文件清单。

`scripts/lib/args.js`：命令行参数解析和单主操作约束。

`scripts/lib/fs-json.js`：路径展开、JSON 读写和原子写入。

`scripts/lib/profile-store.js`：profile 路径、settings 摘要、列表、状态展示和 settings 路径输出。

`scripts/lib/health.js`：健康探测、`health.json` 写入、TTL 复用和失败计数。

`scripts/lib/profile-init.js`：保存当前 live 配置为 profile，并执行首次健康探测。

`scripts/lib/global-overwrite.js`：旧版全局覆盖回退和备份逻辑。

`scripts/lib/output.js`：用户可见错误和帮助文本输出。

`references/profile-management.md`：profile 存储和维护说明。只有账号切换异常、Claude Code 配置位置变化、增加 provider 或排查缺失 profile 时才需要读取。
