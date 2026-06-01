const fs = require("fs");
const path = require("path");

const {
  ACTIVE_MARKER,
  CLAUDE_DIR,
  DEFAULT_MODE,
  HEALTH_FILE,
  ISOLATED_SETTING_SOURCES,
  SETTINGS_FILE,
} = require("./constants");
const { ensureDir, safeReadJson } = require("./fs-json");
const { fail } = require("./output");

/**
 * 获取指定 profile 的目录。
 */
function profileDir(options, profile) {
  return path.join(options.profilesRoot, profile);
}

/**
 * 获取指定 profile 中的文件。
 */
function profilePath(options, profile, filename) {
  return path.join(profileDir(options, profile), filename);
}

/**
 * 获取旧版回退模式管理的 profile 文件。
 */
function managedProfileFile(options, profile, managedFile) {
  return profilePath(options, profile, managedFile.profilePath);
}

/**
 * 限制 profile 名称，避免路径穿越和意外目录访问。
 */
function validateProfileName(profile) {
  if (!profile || !/^[a-zA-Z0-9._-]+$/.test(profile)) {
    fail(
      "profile 名称只能包含字母、数字、点、下划线和连字符 " +
        "(Profile names may only contain letters, digits, dots, underscores, and hyphens)",
    );
  }
}

/**
 * 校验 JSON 文件格式。
 */
function validateJsonFile(file) {
  if (!fs.existsSync(file)) return;
  safeReadJson(file);
}

/**
 * 隐藏配置摘要中的凭据字段，避免状态命令泄漏 token。
 */
function redactJson(value) {
  if (Array.isArray(value)) return value.map(redactJson);
  if (!value || typeof value !== "object") return value;

  const result = {};
  for (const [key, child] of Object.entries(value)) {
    if (/token|secret|password|credential|auth|api[_-]?key/i.test(key)) {
      result[key] = child ? "<redacted>" : child;
    } else if (typeof child === "object" && child !== null) {
      result[key] = redactJson(child);
    } else {
      result[key] = child;
    }
  }
  return result;
}

/**
 * 读取可展示的 settings 摘要。
 */
function summarizeSettings(settingsPath) {
  const settings = safeReadJson(settingsPath);
  if (!settings) return null;
  return {
    model: settings.model || (settings.env && settings.env.ANTHROPIC_MODEL) || null,
    effortLevel: settings.effortLevel || null,
    env: redactJson(settings.env || {}),
  };
}

/**
 * 校验并返回独立调用所需的 profile settings 路径。
 */
function resolveProfileSettings(options, profile) {
  validateProfileName(profile);
  const settingsPath = profilePath(options, profile, SETTINGS_FILE);
  if (!fs.existsSync(settingsPath)) {
    fail(`profile 缺少 settings.json (Profile settings are missing)：${settingsPath}`);
  }
  validateJsonFile(settingsPath);
  return settingsPath;
}

/**
 * 获取全部包含 settings.json 的 profile。
 */
function findProfiles(options) {
  ensureDir(options.profilesRoot);
  return fs
    .readdirSync(options.profilesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((profile) => fs.existsSync(profilePath(options, profile, SETTINGS_FILE)))
    .sort();
}

/**
 * 列出 profile 和最近一次健康状态。
 */
function listProfiles(options) {
  const active = safeReadJson(ACTIVE_MARKER);
  const profiles = findProfiles(options);
  if (profiles.length === 0) {
    console.log(`未找到 Claude profile (No Claude profiles found)：${options.profilesRoot}`);
    return;
  }

  console.log("Claude profile 列表 (Claude profiles)：");
  console.log("* 表示最近一次旧版全局覆盖记录 (* marks the latest legacy global-overwrite record)");
  for (const profile of profiles) {
    const marker = active && active.profile === profile ? "*" : " ";
    const settingsPath = profilePath(options, profile, SETTINGS_FILE);
    const summary = summarizeSettings(settingsPath);
    const health = safeReadJson(profilePath(options, profile, HEALTH_FILE));
    const model = summary && summary.model ? ` model=${summary.model}` : "";
    const status = health && health.status ? ` health=${health.status}` : " health=unknown";
    console.log(`${marker} ${profile}${model}${status}`);
  }
}

/**
 * 展示默认模式、旧回退切换标记和全局配置摘要。
 */
function printStatus(options) {
  const active = safeReadJson(ACTIVE_MARKER);
  const summary = summarizeSettings(path.join(CLAUDE_DIR, SETTINGS_FILE));
  console.log("Claude profile 状态 (Claude profile status)：");
  console.log(
    JSON.stringify(
      {
        defaultMode: DEFAULT_MODE,
        globalOverwriteActiveProfile: active || null,
        liveSettings: summary,
        profilesRoot: options.profilesRoot,
      },
      null,
      2,
    ),
  );
}

/**
 * 输出 profile settings 路径，供命令替换直接拼接 claude --settings。
 */
function printSettingsPath(options, profile) {
  console.log(resolveProfileSettings(options, profile));
}

/**
 * 默认选择 profile 时仅提示独立调用命令，不修改全局 settings。
 */
function showProfileSettingsUsage(options, profile) {
  const settingsPath = resolveProfileSettings(options, profile);
  console.log(`已选择独立 profile settings (Selected standalone profile settings)：${profile}`);
  console.log(`settings 路径 (Settings path)：${settingsPath}`);
  console.log(
    `调用示例 (Command example)：claude --settings "${settingsPath}" --setting-sources ${ISOLATED_SETTING_SOURCES}`,
  );
  console.log("未修改全局 Claude settings (Global Claude settings were not modified)");
}

module.exports = {
  findProfiles,
  listProfiles,
  managedProfileFile,
  printSettingsPath,
  printStatus,
  profileDir,
  profilePath,
  resolveProfileSettings,
  showProfileSettingsUsage,
  summarizeSettings,
  validateJsonFile,
  validateProfileName,
};
