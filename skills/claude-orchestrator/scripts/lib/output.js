const {
  DEFAULT_MODE,
  ISOLATED_SETTING_SOURCES,
} = require("./constants");

/**
 * 输出双语错误并终止脚本。
 */
function fail(message) {
  console.error(`[claude-profile-switch] 错误 (Error)：${message}`);
  process.exit(1);
}

/**
 * 打印脚本帮助。
 */
function printHelp() {
  console.log(`用法 (Usage):
  node switch-api.js <profile>
  node switch-api.js --settings-path <profile>
  node switch-api.js --ping <profile> [--force] [--ping-timeout-ms <ms>]
  node switch-api.js --ping-all
  node switch-api.js --refresh-health
  node switch-api.js --init-current <profile> [--force]
  node switch-api.js --list
  node switch-api.js --status
  node switch-api.js <profile> --mode global-overwrite [--dry-run] [--no-backup]

模式 (Modes):
  ${DEFAULT_MODE}  默认模式，只输出独立 settings 调用方式，不修改全局配置。
                    Default mode. Use standalone settings without modifying global config.
                    调用 Claude 时应配合 --setting-sources ${ISOLATED_SETTING_SOURCES} 排除全局 user settings。
                    Pair Claude calls with --setting-sources ${ISOLATED_SETTING_SOURCES} to exclude global user settings.
  global-overwrite  旧版回退模式，显式覆盖全局 Claude 配置。
                    Legacy fallback mode. Explicitly overwrite global Claude config.

profile 说明 (Profile notes):
  默认保存在 ~/.claude/profiles/<profile>/。
  Stored in ~/.claude/profiles/<profile>/ by default.
  每个 profile 至少需要 settings.json，可选包含 .claude.json 和 health.json。
  Each profile requires settings.json and may include .claude.json and health.json.
  profile 目录可能包含 token，请不要提交到 git。
  Profile directories may contain tokens. Do not commit them to git.`);
}

module.exports = {
  fail,
  printHelp,
};
