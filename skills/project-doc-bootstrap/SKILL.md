---
name: project-doc-bootstrap
description: Initialize technology-neutral project-level Coding Agent collaboration documentation with document-first development standards, progressive disclosure rule indexes, AGENTSDOC/rules, and a local plans workspace. Use for frontend, backend, full-stack, CLI, desktop, mobile, agent, MCP, data, infrastructure, or library projects after scaffolding, or when standardizing AI-assisted development rules before implementation.
---

# Project Doc Bootstrap

这个 skill 用于在项目搭建后，为项目生成一套基础的 Coding Agent 协作文档和渐进式披露规则结构。

它的目标不是替代项目真实设计，也不是一次性写满所有未来规则；它只负责建立一套稳定入口，让不同 AI、不同开发者进入项目时能先读同一份规则索引，再按任务读取命中的细则，避免计划、契约、模块结构和临时文档四处散落。

## 适用场景

- 新项目刚初始化，希望先建立 `AGENTS.md`、可选 `CLAUDE.md` 和 `AGENTSDOC/rules/`。
- 旧项目开始引入“文档先行”的 AI 协作方式，需要先梳理项目级规则入口。
- 项目中已经出现不同 AI 生成的代码组织、模块契约或计划文档路径不一致问题。
- 用户要求为项目生成基础开发规范、渐进式披露文档、规则索引或过程文档工作台。

## 核心原则

- 先识别项目事实，再生成规则；不要凭空发明技术栈、目录、架构分层、运行方式或构建命令。
- 入口文档只维护元规则、索引和阅读路径；详细规则放入 `AGENTSDOC/rules/`。
- 过程文档放入 `AGENTSDOC/plans/`，默认作为本地工作台，不在根目录或业务代码目录散落。
- 不要为了“看起来完整”创建大量空模块规则；只生成基础全局规则和已确认的项目规则。
- 如果项目已有 `AGENTS.md`、`CLAUDE.md`、`AGENTSDOC/` 或团队贡献文档，必须先读取并合并，不得直接覆盖。

## 执行流程

1. 读取目标项目根目录的现有协作文档和项目事实：
   - `AGENTS.md`、`CLAUDE.md`、`README.md`、贡献文档、`AGENTSDOC/`；
   - 项目清单、依赖管理、构建运行、测试和部署配置；
   - 源码入口、测试目录、领域模块、外部集成和交付方式；
   - `.gitignore`，用于判断过程文档是否已有归档约定。
   - 根据这些事实识别项目类型；不要预设项目一定是前端、后端或某一种语言框架。
2. 判断目标项目适合的入口策略：
   - Codex 项目默认创建或维护 `AGENTS.md`。
   - 如果用户明确提到 Claude Code、多 AI 协作，或项目已有 `CLAUDE.md`，则同步创建或维护 `CLAUDE.md`。
   - 双入口项目中，`AGENTS.md` 与 `CLAUDE.md` 应保持等价内容或明确同步纪律，避免不同 AI 读取到不同规则。
3. 生成或更新基础结构：
   - `AGENTS.md`
   - 可选 `CLAUDE.md`
   - `AGENTSDOC/rules/global/project.md`
   - `AGENTSDOC/rules/global/task-boundary.md`
   - `AGENTSDOC/rules/global/comments.md`
   - `AGENTSDOC/rules/global/doc-archive.md`
   - `AGENTSDOC/rules/global/module-structure.md`
   - `AGENTSDOC/plans/`
4. 只为目标项目真实存在且需要长期约束的职责生成规则目录，例如 `modules/`、`services/`、`api/`、`data/`、`infrastructure/`；只有识别到界面层时才考虑 `components/`、`pages/` 等目录。
5. 若 `AGENTSDOC/plans/` 需要默认不入库，只在用户同意或项目已有同类约定时更新 `.gitignore`；不要为了保留空目录强行添加无意义文件。
6. 生成后检查：
   - 根入口是否索引了所有新增正式规则；
   - `rules/` 下是否没有未索引的正式规则；
   - 入库文档是否没有链接到 `AGENTSDOC/plans/` 下具体文件；
   - 是否只生成了项目协作必需且已经确认的规则。

## 生成要求

- 规则文本必须围绕目标项目真实结构改写，不能直接把参考项目的业务名、框架名或私有目录照搬。
- 规则类型必须与目标项目匹配；前端、后端、Agent、CLI、数据处理或基础设施项目只生成各自命中的规则，不套用其它类型的目录和术语。
- 如果某项项目信息暂时无法确认，在规则里标记为“待确认”，或先留出索引占位，不要编造。
- 根入口文档应短而清晰，避免把所有细则塞进一个文件造成上下文膨胀。
- 规则文件应包含“适用场景”“硬规则”“详细说明”三类信息，方便 AI 按需读取。
- 新增规则后必须同步维护根入口索引，写清触发读取条件和规则路径。
- 默认不修改业务代码；如果用户同时要求初始化项目代码，应先完成协作文档，再按文档约束继续开发。

## 参考模板

基础模板见 `references/default-files.md`。使用模板时必须按目标项目事实改写占位内容，不要机械复制。
