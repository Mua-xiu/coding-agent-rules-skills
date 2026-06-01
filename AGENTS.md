# 项目协作入口

本文件只维护本仓库专属的渐进披露规则，不重复通用 Coding Agent 协作规则。通用回复语言、任务边界、注释习惯、旧代码处理等规则由本机 Codex / Claude 全局配置保证；对外复用模板维护在 `AGENTS-template.md`。

具体规则按下方索引按需读取，不命中的规则不读。

## 元规则（本仓库专属）

- `AGENTS-template.md` 是上传 GitHub 后给其他项目复制使用的通用规则模板；本仓库自身执行任务时不要把它当作项目规则入口。
- `AGENTSDOC/rules/` 入库，保存本仓库专属细则；新增或调整 `AGENTSDOC/rules/` 下的规则时，必须同步更新本文件的规则索引。
- `AGENTSDOC/plans/` 是本地过程文档工作台，默认不入库；计划、重构、复盘、基线等过程文档放到 `AGENTSDOC/plans/<模块>/`，不允许散落根目录或业务代码目录。
- 入库文档不要写指向 `AGENTSDOC/plans/` 下具体文件的链接；如需查阅过程文档，只说明去本地对应模块目录查找，避免克隆后出现死链。

## 共享工具与脚本登记

以下共享关系会影响多个 skill 的脚本一致性。改动相关脚本、共享状态读写协议或新增同类共享关系前，必须先读取 `AGENTSDOC/rules/global/shared-skills.md`。

- 共享组：`claude-orchestrator` + `claude-roundtable`
  - 脚本运行时共享状态目录：`~/.claude/profiles/<profile>/`（仓库任务不直接修改该用户目录）
  - 主版本脚本：`skills/claude-orchestrator/scripts/switch-api.js`
  - 从版本脚本：`skills/claude-roundtable/scripts/switch-api.js`（如该路径存在）
  - 基本要求：先改主版本，再同步从版本；不允许只改其中一份。

未来如果新增共享脚本、共享工具或共享本地状态读写协议，必须先在本节登记共享组、主从路径和脚本约定，再开始实现。

## 全局规则索引（rules/global/）

- 改动“共享工具与脚本登记”中的脚本、主从关系、共享状态读写协议，或新增同类共享关系 → `AGENTSDOC/rules/global/shared-skills.md`
- 编写或修改 `skills/*/scripts/` 下脚本的用户可见提示、错误信息、状态摘要、交互引导或共享数据错误字段 → `AGENTSDOC/rules/global/skill-script-i18n.md`

## 模块规则索引（rules/<模块>/）

- 修改 `skills/claude-orchestrator/scripts/` 下 CLI 入口、`scripts/lib/` 模块、profile 调用协议、健康探测或 `global-overwrite` 回退逻辑 → `AGENTSDOC/rules/claude-orchestrator/scripts.md`

## 阅读路径

1. 进入仓库，先读本文件，确认本次任务是否命中项目专属规则。
2. 按当前任务在全局规则索引和模块规则索引中命中对应文件。
3. 不命中的规则不读，避免无关上下文干扰。
4. 如果任务涉及新增或调整项目专属规则，必须先更新对应规则文件，再同步维护本文件索引。
