# claude-orchestrator 优化备忘

本文档记录 `claude-orchestrator` skill 后续可以参考 `claude-roundtable` skill 的实现思路所做的优化设计。这里只是设计备忘，不属于 active skill；落地实现时再单独评估和拆分。

## 一、背景

当前 `claude-orchestrator` 切换 profile 的方式是：

```text
~/.claude/profiles/<profile>/settings.json
        ↓ 复制覆盖
~/.claude/settings.json
```

也就是直接覆盖 Claude Code 的全局 live 配置。

带来的副作用：

- 跑完任务后，全局账号被切走，日常使用前还要切回。
- 切换是“串行 + 全局”，无法并发同时使用多个 profile。
- 切换过程中如果异常退出，全局配置可能停留在错误账号上。
- 任何使用 Claude Code 的会话都会被这次切换影响，包括 IDE 插件正在跑的会话。

## 二、参考 claude-roundtable 的核心思路

`claude-roundtable` 跑多模型会议时不会修改全局 settings。它使用 `claude -p --settings <文件>` 的能力，让每个参与者用一份独立的 settings 跑起来，互不干扰，也不污染日常 Claude Code。

这里借鉴的是“通过 `--settings` 指定独立配置文件运行 Claude CLI”的调用方式，而不是继承 `claude-roundtable` 的旧存储架构。新的 `claude-orchestrator` 优先使用现有 profile 备份目录中的真实 settings 快照，不继续沿用 `api-profiles.json` 或每次生成临时 settings 文件的模式。

把这个思路迁移到 `claude-orchestrator` 之后，方向变成：

- 不再覆盖 `~/.claude/settings.json`。
- profile 文件本身就是“一份完整可用的 settings 快照”，可以直接作为 `--settings` 的参数使用。
- 切换 profile 不再 = 改全局，仅意味着“下次启动 claude 时使用哪一份 profile 文件”。

## 三、profile 存储与调用方式

### 3.1 不继承 api-profiles.json 索引文件

现有结构已经具备天然索引能力：

```text
~/.claude/profiles/<profile>/settings.json
~/.claude/profiles/<profile>/.claude.json
```

profile 名 = 目录名，路径完全可推导，扫目录就能拿到全部候选。旧 roundtable 的 `api-profiles.json` 不作为新方案的配置源；再额外维护一份索引文件没有带来新的能力，反而增加了“目录与索引不一致”的风险，因此不引入。

### 3.2 不生成临时 settings 文件

profile 目录中保存的就是“完整 settings 快照”，本身就是真实存在的文件路径，可以直接作为 `--settings` 参数：

```bash
claude -p --settings "~/.claude/profiles/architect/settings.json" ...
```

带来的好处：

- 不复制、不清理，没有“临时副本和源不一致”的问题。
- 不污染全局 settings，跑完即结束，无需切回。
- 不浪费 IO 和 token，避免每次都读写一份临时文件。
- profile 文件永远只有一份“源”，可读、可写、可 diff。

如果用户日常给 Claude Code 增加了新字段或新 provider，应自行同步到对应 profile 目录中的 settings 文件；skill 不会替用户做这层合并。这一约定写入 `claude-orchestrator` 的说明文档即可，不需要在脚本里实现 overlay 能力。

这也是本方案和旧 roundtable 实现的关键差异：旧方案会根据 profile 数据生成临时 settings 文件，新方案直接复用已经备份好的标准 Claude settings 快照，避免反复生成、清理和同步临时文件。

### 3.3 全局 settings 不再被覆盖

迁移后切换 profile 不再 = 覆盖全局 settings。带来的好处：

- 用户日常使用的 Claude Code 账号永远不会被 skill 偷偷改掉。
- `claude-orchestrator` 可以并发委派多个 profile 的子任务。
- IDE 插件、其他会话不受影响。
- skill 异常中断时，没有需要回滚的全局状态。

### 3.4 共享脚本与状态读写协议纪律

profile 目录是相关脚本运行时复用的本地状态目录；仓库任务不直接编辑用户目录里的真实 profile 数据，只修改脚本和脚本对该目录的读写协议。共享纪律已经在仓库根目录的 `AGENTS.md` 与 `AGENTSDOC/rules/global/shared-skills.md` 中登记，要点：

- 共享目录由脚本独占管理，用户不直接手改文件，避免不一致。
- 两个 skill 的 `switch-api.js` 采用“一主一从”模式：主版本在 `skills/claude-orchestrator/scripts/`，从版本在 `skills/claude-roundtable/scripts/`，改动先改主版本再同步到从版本。

### 3.5 兼容旧脚本

现有的 `scripts/switch-api.js`、备份目录 `~/.claude/profile-switch-backups/`、`active-profile.json` 都可以保留一段时间，作为“旧切全局”的回退路径。

新版本可以按以下方式渐进迁移：

1. 增加 `--mode=profile-settings`（默认）和 `--mode=global-overwrite`（旧行为）。
2. 默认走“profile 文件原地用作 `--settings`”的新路径；旧的全局覆盖只在用户显式指定时使用。
3. 等新模式稳定后再废弃全局覆盖路径。

`--mode=profile-settings` 只负责解析并输出/使用 `~/.claude/profiles/<profile>/settings.json` 这份现成配置，不生成临时 settings 文件。

### 3.6 安全规则

迁移时仍保留原 skill 的安全约束：

- profile 内容不进仓库。
- 日志、回复、handoff 中不出现完整 token。
- profile 名称仍按 `architect` / `implementer` / `mechanic` 这类职责命名。

## 四、参与者数量灵活化与健康探测

### 4.1 配置驱动 + 显式截断

读取 profile 目录时，把所有用户已经保存的 profile 都视为候选参与者：

- 用户保存了 1 个 profile，就只有 1 个参与者。
- 保存了 2 个，就 2 个参与者。
- 保存了 N 个，就 N 个参与者。

允许命令行参数显式指定：

```bash
--profiles architect,implementer
--profiles all
--max-participants 3
```

### 4.2 调用前健康探测

为了避免账号失活后还派任务给它，每次会议或委派前对候选 profile 做轻量探测：

- 提示语：`Reply with the single word: ok`
- `--max-tokens 8`
- 默认超时：日常探测 `--timeout 30s`；首次执行 `--init-current` 时使用 `--timeout 60s`，避免首跑加载更慢导致误判。
- 脚本自身再加一个稍大一点的总超时（约 `45–60s`），避免 CLI 进入非典型挂死状态导致整个流程卡死。
- 判定放宽：返回非空、非鉴权错误、非超时即视为可用，不强求字面 `ok`，避免某些模型加修饰被误判为失败。

探测结果写到对应 profile 的 `health.json`。

### 4.3 健康缓存放在 profile 目录

健康缓存按 profile 各自一份，放在 profile 自己的目录里：

```text
~/.claude/profiles/
├── architect/
│   ├── settings.json        # 完整 Claude settings 快照
│   ├── .claude.json         # 可选
│   └── health.json          # 测活结果，本 profile 独占
├── implementer/
│   └── ...
└── _runs/                   # 可选：每次跑的运行日志
    └── 2026-05-29-103000/
```

`health.json` 字段示例：

```json
{
  "status": "ok",
  "last_ping_at": "2026-05-29T10:30:00Z",
  "latency_ms": 842,
  "model": "claude-3-7-sonnet",
  "error_code": null,
  "error_message_raw": null,
  "error_message_zh": null
}
```

按 profile 各持一份，避免多脚本并发写同一个全局缓存文件时产生竞态。

### 4.4 缓存 TTL 与失败兜底

- 默认 TTL 设为 `5h`：在 5 小时内 `status=ok` 的 profile 视为可信，直接复用，不重测。
- `status=down` 的 profile 不受 TTL 保护：每次任务开始时都自动重测一次，避免“账号已恢复，但还要等 5 小时才能用”的体验问题。
- 错误立即重测：实际调用 `claude -p --settings <profile>` 出现以下情况之一，立刻重 ping 该 profile，并更新 `health.json`：
  - 鉴权失败：`401` / `403` / `invalid api key` / `unauthorized`。
  - 配额或限流：`429` / `quota exceeded`。
  - 服务端错误：`5xx`。
  - 网络层错误：连接超时、DNS 失败、TLS 失败。
  - 长时间无响应（例如 `60s` 没有首 token）。
  - CLI 进程非 0 退出，且 stderr 命中已知错误模式。
- 重测仍失败：`status` 标为 `down`，写入对应错误信息；本次任务跳过这个 profile，并在最终回复中告知用户。
- 提供手动强制刷新出口：

  ```bash
  switch-api.js --ping <profile>          # 单个 profile
  switch-api.js --ping-all                # 全部，忽略 TTL
  switch-api.js --refresh-health          # 别名
  ```

### 4.5 init-current 即时探测

执行 `--init-current <profile>` 时立刻 ping 一次：

```text
保存当前 live 配置为 profile
        ↓
立即 ping 这个 profile
        ↓
ping 成功 → health.json.status = ok
ping 失败 → health.json.status = down + error_code/error_message_*
        ↓
中文为主、英文括号补充地输出给用户
```

这样用户在保存账号的当下就能确认“这个账号是不是真的能跑”，不需要等到第一次正式委派才发现失败。

### 4.6 失败 profile 仅暂时跳过

失败的 profile 不持久 disabled：

- 共享目录中只记录 `status=down` 与最近一次错误信息，本身不需要用户手动清理或激活。
- 每次任务开始时对 `status=down` 的 profile 自动重测，恢复后立即可用。
- 多次连续失败的 profile，在最终输出中明确告知用户“此 profile 已连续失败 N 次”，由用户决定是否进一步排查。

### 4.7 最低参与者数

在“参与者数量灵活”之上，仍保留最低门槛：

- 圆桌讨论默认 ≥ 2 个参与者；不足 2 个则降级为单模型回答 + Codex 复核。
- 委派类任务默认 ≥ 1 个参与者；0 个则 Codex 自己接管。

避免“账号全部失活时 skill 卡住”。

## 五、整体流程

把以上能力串起来：

```text
Codex 触发 orchestrator / roundtable
        ↓
扫 ~/.claude/profiles/ 拿候选
        ↓
对每个候选读 health.json
   ├── status=ok 且 last_ping_at < 5h    → 直接视为可用
   └── 否则                              → 立即 ping，更新 health.json
        ↓
得到本次实际可用 profile 列表
        ↓
按 skill 各自策略选参与者
   ├── orchestrator：按职责选 1 个
   └── roundtable：取所有可用，截断到 max
        ↓
claude -p --settings ~/.claude/profiles/<profile>/settings.json
        ↓
若调用过程中命中错误模式
   → 强制重 ping，并降级处理
        ↓
任务结束，更新 health.json，**不动**全局 ~/.claude/settings.json
```

## 六、新 skill 的讨论记录与计划生成边界

新 skill 后续会借鉴旧 roundtable 的“多模型讨论”机制，但讨论记录的主要目的不是做长期项目归档，而是保证切换不同模型账号后，后续账号能读取前序账号的输出、质疑和修正意见，从而形成可追踪的辩论链。

### 6.1 讨论记录只服务本轮辩论和审查

讨论过程中仍需要保留必要运行产物，例如：

- 每个参与者的 `session-id` 或等价会话标识。
- 每轮消息的顺序记录。
- 当前控制器状态。
- 面向 Codex 审查的讨论 transcript。

这些记录用于：

- 让下一个模型账号知道上一位模型的结论和理由。
- 让模型之间可以围绕明确观点进行质疑、回应和修正。
- 让 Codex 在最终裁决时有可核查依据。

这些记录不默认作为目标项目长期文档归档，不需要一开始设计复杂的项目级目录体系。具体落盘位置可以先由新 skill 自身的运行目录管理，后续真实使用中如果发现需要长期归档，再单独设计。

### 6.2 Codex 最终裁决与问题分级

讨论结束后，不由模型投票替代结论，必须由 Codex 读取讨论记录并裁决：

- 哪些观点有充分证据。
- 哪些观点只是猜测或过度设计。
- 哪些问题会阻塞任务执行。
- 哪些问题只是优化项或未来扩展项。

Codex 需要把讨论中发现的问题按等级告知用户：

- `P0`：高危或阻塞问题，不解决不能继续。
- `P1`：正式执行前必须处理的问题，否则会明显影响正确性、安全性或主要目标。
- `P2`：应该处理的问题，会影响质量、维护性或边界情况，但不阻塞主线。
- `P3`：可延后优化项。
- `P4`：未来扩展或体验增强建议。

模型可以提出分级建议，但最终等级由 Codex 根据任务目标、证据和风险统一判断。

### 6.3 计划文档生成时机

最终计划文档不是无条件生成。

- 无论问题属于 `P0`、`P1`、`P2`、`P3` 还是 `P4`，Codex 都必须把问题等级、影响和建议处理方式告知用户，不能因为问题较小就隐藏。
- 如果存在 `P0` / `P1` 或任务边界仍不明确，Codex 应先询问用户是否需要补充、修正或生成计划文档，避免把阻塞问题直接写进待执行计划。
- 如果只存在 `P2` / `P3` / `P4` 这类非阻塞问题，且任务边界、执行顺序和验收方式已经明确，Codex 可以先生成计划文档草案，同时在反馈中明确列出这些问题及其优先级，询问用户是否需要先调整计划再执行。
- 如果讨论结论表明任务可以直接完成，且无需长期留存计划文档，Codex 可以直接说明执行方案并等待用户确认，避免为了形式制造文档。

计划文档应只承载 Codex 裁决后的可执行方案，不应简单粘贴完整讨论记录。完整讨论内容只作为审查依据和辩论上下文。

## 七、落地顺序与现有文档关系

- 这份文档不是 skill，只是优化备忘。
- 落地顺序应先在 `claude-orchestrator` 中实现“独立 `--settings` 调用、不污染全局 settings”的新模式，验证稳定后，再基于同一套共享脚本/读写协议开发新的 skill。
- 如果要落地，应该新建分支，单独修改 `skills/claude-orchestrator/` 下的脚本和说明文档。
- 共享脚本与状态读写协议登记在 `AGENTS.md`，详细纪律在 `AGENTSDOC/rules/global/shared-skills.md`。
- 脚本用户可见输出的中英双语规范在 `AGENTSDOC/rules/global/skill-script-i18n.md`。
- 不要静默替换现有 active skill 的默认行为；新模式应通过明确的默认模式、文档和验证步骤逐步切换，保留旧全局覆盖模式作为临时回退。

## 八、待后续完善问题

- `--settings` 在不同 Claude Code 版本下的兼容性需要验证。
- 健康探测的提示语和判定标准需要与实际 provider 兼容，避免误判。
- 健康缓存 TTL 默认 5 小时是否需要按 provider 分别调整，等真实使用时再校准。
- 错误模式列表（鉴权、限流、5xx、网络层）需要在脚本中维护一份可扩展的匹配规则。
