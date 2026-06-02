#!/usr/bin/env node

const { parseArgs } = require("./lib/args");
const { switchGlobalProfile } = require("./lib/global-overwrite");
const { pingAllProfiles, pingProfile } = require("./lib/health");
const { initCurrentProfile } = require("./lib/profile-init");
const {
  listProfiles,
  printSettingsPath,
  printStatus,
  showProfileSettingsUsage,
} = require("./lib/profile-store");
const { printHelp } = require("./lib/output");

/**
 * CLI 薄入口：只负责命令分发，具体能力放在 scripts/lib/ 下维护。
 */
function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.list) return listProfiles(options);
  if (options.status) return printStatus(options);
  if (options.initCurrent) return initCurrentProfile(options, options.initCurrent);
  if (options.settingsPath) return printSettingsPath(options, options.settingsPath);
  if (options.ping) {
    const health = pingProfile(options, options.ping, { forceRefresh: options.force });
    if (health.status !== "ok") process.exitCode = 1;
    return health;
  }
  if (options.pingAll) return pingAllProfiles(options, false);
  if (options.refreshHealth) return pingAllProfiles(options, true);
  if (!options.profile) {
    printHelp();
    process.exit(1);
  }
  if (options.mode === "global-overwrite") {
    return switchGlobalProfile(options, options.profile);
  }
  return showProfileSettingsUsage(options, options.profile);
}

main();
