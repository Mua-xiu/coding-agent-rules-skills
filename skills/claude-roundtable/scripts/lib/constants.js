const os = require("os");
const path = require("path");

const HOME = os.homedir();
const CLAUDE_DIR = path.join(HOME, ".claude");
const DEFAULT_PROFILES_ROOT = path.join(CLAUDE_DIR, "profiles");
const ACTIVE_MARKER = path.join(CLAUDE_DIR, "active-profile.json");
const BACKUP_ROOT = path.join(CLAUDE_DIR, "profile-switch-backups");

// 默认模式只把 profile settings 交给 Claude CLI，不覆盖用户的全局配置。
const DEFAULT_MODE = "profile-settings";
const SUPPORTED_MODES = new Set([DEFAULT_MODE, "global-overwrite"]);

// 健康状态默认复用 5 小时，避免每次委派前都额外消耗一次模型调用。
const DEFAULT_HEALTH_TTL_MS = 5 * 60 * 60 * 1000;
const DEFAULT_PING_TIMEOUT_MS = 30 * 1000;
const INIT_PING_TIMEOUT_MS = 60 * 1000;
const HEALTH_FILE = "health.json";
const SETTINGS_FILE = "settings.json";
const HEALTH_PROMPT = "Reply with the single word: ok";

// 排除 user setting source，避免当前全局 ~/.claude/settings.json 污染独立 profile 调用。
const ISOLATED_SETTING_SOURCES = "project,local";

// 仅旧版 global-overwrite 回退模式需要复制这些 live 配置。
const MANAGED_FILES = [
  {
    label: SETTINGS_FILE,
    profilePath: SETTINGS_FILE,
    livePath: path.join(CLAUDE_DIR, SETTINGS_FILE),
    required: true,
  },
  {
    label: ".claude.json",
    profilePath: ".claude.json",
    livePath: path.join(HOME, ".claude.json"),
    required: false,
  },
];

module.exports = {
  ACTIVE_MARKER,
  BACKUP_ROOT,
  CLAUDE_DIR,
  DEFAULT_HEALTH_TTL_MS,
  DEFAULT_MODE,
  DEFAULT_PING_TIMEOUT_MS,
  DEFAULT_PROFILES_ROOT,
  HEALTH_FILE,
  HEALTH_PROMPT,
  HOME,
  INIT_PING_TIMEOUT_MS,
  ISOLATED_SETTING_SOURCES,
  MANAGED_FILES,
  SETTINGS_FILE,
  SUPPORTED_MODES,
};
