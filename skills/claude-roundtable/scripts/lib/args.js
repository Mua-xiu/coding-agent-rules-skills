const {
  DEFAULT_MODE,
  DEFAULT_PING_TIMEOUT_MS,
  DEFAULT_PROFILES_ROOT,
  SUPPORTED_MODES,
} = require("./constants");
const { resolveUserPath } = require("./fs-json");
const { fail, printHelp } = require("./output");

/**
 * 解析命令行参数，并保持每次只执行一个主操作。
 */
function parseArgs(argv) {
  const options = {
    profile: null,
    profilesRoot: DEFAULT_PROFILES_ROOT,
    mode: DEFAULT_MODE,
    dryRun: false,
    noBackup: false,
    force: false,
    list: false,
    status: false,
    initCurrent: null,
    settingsPath: null,
    ping: null,
    pingAll: false,
    refreshHealth: false,
    pingTimeoutMs: DEFAULT_PING_TIMEOUT_MS,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--profiles-root") {
      options.profilesRoot = resolveUserPath(requireValue(argv, ++index, arg));
    } else if (arg === "--mode") {
      options.mode = requireValue(argv, ++index, arg);
    } else if (arg === "--init-current") {
      options.initCurrent = requireValue(argv, ++index, arg);
    } else if (arg === "--settings-path") {
      options.settingsPath = requireValue(argv, ++index, arg);
    } else if (arg === "--ping") {
      options.ping = requireValue(argv, ++index, arg);
    } else if (arg === "--ping-all") {
      options.pingAll = true;
    } else if (arg === "--refresh-health") {
      options.refreshHealth = true;
    } else if (arg === "--ping-timeout-ms") {
      options.pingTimeoutMs = parsePositiveInteger(requireValue(argv, ++index, arg), arg);
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--no-backup") {
      options.noBackup = true;
    } else if (arg === "--force") {
      options.force = true;
    } else if (arg === "--list") {
      options.list = true;
    } else if (arg === "--status") {
      options.status = true;
    } else if (arg === "-h" || arg === "--help") {
      printHelp();
      process.exit(0);
    } else if (arg.startsWith("-")) {
      fail(`未知参数 (Unknown option)：${arg}`);
    } else if (!options.profile) {
      options.profile = arg;
    } else {
      fail(`只能指定一个 profile (Only one profile is allowed)，收到多余参数：${arg}`);
    }
  }

  if (!SUPPORTED_MODES.has(options.mode)) {
    fail(`不支持的模式 (Unsupported mode)：${options.mode}`);
  }

  const actions = [
    options.profile,
    options.list,
    options.status,
    options.initCurrent,
    options.settingsPath,
    options.ping,
    options.pingAll,
    options.refreshHealth,
  ].filter(Boolean);
  if (actions.length > 1) {
    fail("一次只能执行一个主操作 (Only one primary action can be used at a time)");
  }

  options.profilesRoot = resolveUserPath(options.profilesRoot);
  return options;
}

/**
 * 读取带值参数，避免缺少值时继续执行危险操作。
 */
function requireValue(argv, index, flag) {
  const value = argv[index];
  if (!value || value.startsWith("-")) {
    fail(`${flag} 需要一个值 (requires a value)`);
  }
  return value;
}

/**
 * 解析正整数参数，主要用于健康探测超时。
 */
function parsePositiveInteger(value, flag) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    fail(`${flag} 必须是正整数 (must be a positive integer)：${value}`);
  }
  return number;
}

module.exports = {
  parseArgs,
};
