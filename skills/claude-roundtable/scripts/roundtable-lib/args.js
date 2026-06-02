const fs = require("fs");

const {
  DEFAULT_PING_TIMEOUT_MS,
  DEFAULT_PROFILES_ROOT,
} = require("../lib/constants");
const { resolveUserPath } = require("../lib/fs-json");

const DEFAULT_MAX_PARTICIPANTS = 3;
const DEFAULT_MAX_DIRECTED_TURNS = 6;
const DEFAULT_TIMEOUT_MS = 180 * 1000;
const DEFAULT_READ_ONLY_TOOLS = ["Read", "Glob", "Grep"];
const ALLOWED_READ_ONLY_TOOLS = new Set(DEFAULT_READ_ONLY_TOOLS);

/**
 * 解析 roundtable CLI 参数；所有会影响费用或权限的选项都必须显式传入。
 */
function parseRoundtableArgs(argv) {
  const options = {
    topic: null,
    topicFile: null,
    codexBrief: null,
    codexBriefFile: null,
    profiles: "all",
    maxParticipants: DEFAULT_MAX_PARTICIPANTS,
    maxDirectedTurns: DEFAULT_MAX_DIRECTED_TURNS,
    profilesRoot: DEFAULT_PROFILES_ROOT,
    runDir: null,
    dryRun: false,
    effort: "low",
    timeoutMs: DEFAULT_TIMEOUT_MS,
    pingTimeoutMs: DEFAULT_PING_TIMEOUT_MS,
    tools: "",
    addDirs: [],
    readScopes: [],
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--topic") {
      options.topic = requireValue(argv, ++index, arg);
    } else if (arg === "--topic-file") {
      options.topicFile = resolveUserPath(requireValue(argv, ++index, arg));
    } else if (arg === "--codex-brief") {
      options.codexBrief = requireValue(argv, ++index, arg);
    } else if (arg === "--codex-brief-file") {
      options.codexBriefFile = resolveUserPath(requireValue(argv, ++index, arg));
    } else if (arg === "--profiles") {
      options.profiles = requireValue(argv, ++index, arg);
    } else if (arg === "--max-participants") {
      options.maxParticipants = parsePositiveInteger(requireValue(argv, ++index, arg), arg);
    } else if (arg === "--max-directed-turns") {
      options.maxDirectedTurns = parseNonNegativeInteger(requireValue(argv, ++index, arg), arg);
    } else if (arg === "--profiles-root") {
      options.profilesRoot = resolveUserPath(requireValue(argv, ++index, arg));
    } else if (arg === "--run-dir") {
      options.runDir = resolveUserPath(requireValue(argv, ++index, arg));
    } else if (arg === "--effort") {
      options.effort = requireValue(argv, ++index, arg);
    } else if (arg === "--timeout-ms") {
      options.timeoutMs = parsePositiveInteger(requireValue(argv, ++index, arg), arg);
    } else if (arg === "--ping-timeout-ms") {
      options.pingTimeoutMs = parsePositiveInteger(requireValue(argv, ++index, arg), arg);
    } else if (arg === "--tools") {
      options.tools = requireValue(argv, ++index, arg);
    } else if (arg === "--add-dir") {
      options.addDirs.push(resolveUserPath(requireValue(argv, ++index, arg)));
    } else if (arg === "--read-scope") {
      options.readScopes.push(resolveUserPath(requireValue(argv, ++index, arg)));
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "-h" || arg === "--help") {
      options.help = true;
    } else {
      throw new Error(`未知参数 (Unknown option)：${arg}`);
    }
  }

  if (options.help) return options;
  if (options.topic && options.topicFile) {
    throw new Error("只能指定 --topic 或 --topic-file 其中一个 (Use either --topic or --topic-file)");
  }
  if (!options.topic && !options.topicFile) {
    throw new Error("必须提供讨论主题 (Discussion topic is required)：--topic 或 --topic-file");
  }
  if (options.topicFile) {
    options.topic = fs.readFileSync(options.topicFile, "utf8").replace(/^\uFEFF/, "").trim();
  }
  if (!options.topic.trim()) {
    throw new Error("讨论主题不能为空 (Discussion topic cannot be empty)");
  }
  if (options.codexBrief && options.codexBriefFile) {
    throw new Error("只能指定 --codex-brief 或 --codex-brief-file 其中一个 (Use either --codex-brief or --codex-brief-file)");
  }
  if (options.codexBriefFile) {
    options.codexBrief = fs.readFileSync(options.codexBriefFile, "utf8").replace(/^\uFEFF/, "").trim();
  }
  if (!options.dryRun && !options.codexBrief) {
    throw new Error(
      "真实讨论必须提供 Codex 预分析：--codex-brief 或 --codex-brief-file (Real roundtable runs require --codex-brief or --codex-brief-file)",
    );
  }
  applyReadOnlyPolicy(options);
  options.profilesRoot = resolveUserPath(options.profilesRoot);
  return options;
}

/**
 * 读取带值参数，避免缺少值时误把下一个 flag 当作普通值。
 */
function requireValue(argv, index, flag) {
  const value = argv[index];
  if (!value || value.startsWith("-")) {
    throw new Error(`${flag} 需要一个值 (${flag} requires a value)`);
  }
  return value;
}

/**
 * 解析正整数参数。
 */
function parsePositiveInteger(value, flag) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    throw new Error(`${flag} 必须是正整数 (${flag} must be a positive integer)：${value}`);
  }
  return number;
}

/**
 * 解析可为 0 的整数，主要用于关闭 directed routing。
 */
function parseNonNegativeInteger(value, flag) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) {
    throw new Error(`${flag} 必须是非负整数 (${flag} must be a non-negative integer)：${value}`);
  }
  return number;
}

/**
 * roundtable 只允许纯文本或受限只读讨论，避免讨论阶段意外开放修改能力。
 */
function applyReadOnlyPolicy(options) {
  const requestedTools = options.tools
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (options.readScopes.length > 0 && requestedTools.length === 0) {
    requestedTools.push(...DEFAULT_READ_ONLY_TOOLS);
  }
  const invalidTools = requestedTools.filter((tool) => !ALLOWED_READ_ONLY_TOOLS.has(tool));
  if (invalidTools.length > 0) {
    throw new Error(
      `roundtable 只允许只读工具 (Roundtable only allows read-only tools)：${invalidTools.join(", ")}`,
    );
  }
  if (requestedTools.length > 0 && options.readScopes.length === 0) {
    throw new Error(
      "启用只读工具时必须至少提供一个 --read-scope (At least one --read-scope is required when read-only tools are enabled)",
    );
  }
  if (options.addDirs.length > 0 && options.readScopes.length === 0) {
    throw new Error(
      "--add-dir 必须与 --read-scope 配合使用 (--add-dir requires at least one --read-scope)",
    );
  }

  options.tools = [...new Set(requestedTools)].join(",");
  options.discussionMode = options.tools === "" ? "text-only" : "scoped-readonly";
}

/**
 * 输出中英双语帮助，方便用户直接复制命令。
 */
function printHelp() {
  console.log(`用法 (Usage):
  node scripts/roundtable.js --topic "..." [options]
  node scripts/roundtable.js --topic-file .\\topic.md --profiles architect,implementer

选项 (Options):
  --codex-brief <text>           Codex 预分析摘要，不发送给参与者。Codex baseline, not sent to participants.
  --codex-brief-file <path>      从文件读取 Codex 预分析。Read Codex baseline from file.
  --profiles <list|all>          参与 profile，默认 all。Profiles to use, default all.
  --max-participants <n>         最多参与者数量，默认 ${DEFAULT_MAX_PARTICIPANTS}。Max participants.
  --max-directed-turns <n>       定向消息上限，默认 ${DEFAULT_MAX_DIRECTED_TURNS}。Directed-message limit.
  --profiles-root <path>         profile 根目录，默认 ~/.claude/profiles。Profiles root.
  --run-dir <path>               指定本次运行目录。Exact run directory.
  --effort <level>               Claude effort，默认 low。Claude effort level.
  --timeout-ms <ms>              单次 Claude 调用超时，默认 ${DEFAULT_TIMEOUT_MS}。Per-call timeout.
  --ping-timeout-ms <ms>         健康探测超时。Health-check timeout.
  --tools <tools>                只允许 Read,Glob,Grep；配合 --read-scope。Read-only tools only.
  --read-scope <path>            允许读取的主题相关范围，可重复传入。Repeatable read scope.
  --add-dir <path>               允许 Claude 工具访问的额外目录。Additional allowed directory.
  --dry-run                      只生成运行计划，不调用 Claude。Plan without calling Claude.
  -h, --help                     显示帮助。Show help.`);
}

module.exports = {
  parseRoundtableArgs,
  printHelp,
};
