const fs = require("fs");
const path = require("path");

const {
  INIT_PING_TIMEOUT_MS,
  MANAGED_FILES,
} = require("./constants");
const {
  ensureDir,
  writeJson,
} = require("./fs-json");
const { pingProfile } = require("./health");
const { fail } = require("./output");
const {
  managedProfileFile,
  profileDir,
  validateJsonFile,
  validateProfileName,
} = require("./profile-store");

/**
 * 保存当前 live 配置为 profile，并立即执行一次放宽超时的健康探测。
 */
function initCurrentProfile(options, profile) {
  validateProfileName(profile);
  const targetDir = profileDir(options, profile);
  if (fs.existsSync(targetDir) && !options.force) {
    fail(`profile 已存在 (Profile already exists)：${targetDir}\n如需覆盖，请加 --force (Use --force to overwrite)`);
  }

  if (options.dryRun) {
    console.log(`[dry-run] 将当前 Claude 配置保存为 profile (Save current Claude config as profile)：${profile}`);
    return;
  }

  ensureDir(targetDir);
  const copied = [];
  for (const managedFile of MANAGED_FILES) {
    if (!fs.existsSync(managedFile.livePath)) {
      if (managedFile.required) {
        fail(`缺少必需的 Claude 配置文件 (Required Claude config is missing)：${managedFile.livePath}`);
      }
      continue;
    }
    validateJsonFile(managedFile.livePath);
    const destination = managedProfileFile(options, profile, managedFile);
    ensureDir(path.dirname(destination));
    fs.copyFileSync(managedFile.livePath, destination);
    copied.push(managedFile.label);
  }

  writeJson(path.join(targetDir, "profile-meta.json"), {
    profile,
    createdAt: new Date().toISOString(),
    managedFiles: copied,
    note: "此目录可能包含 Claude/provider 凭据，只应保存在用户目录，不要提交到仓库。(This directory may contain credentials. Keep it in the user directory and do not commit it.)",
  });

  console.log(`已从当前 Claude 配置创建 profile (Created profile from current Claude config)：${profile}`);
  console.log(`profile 目录 (Profile directory)：${targetDir}`);
  const health = pingProfile(options, profile, {
    forceRefresh: true,
    timeoutMs: INIT_PING_TIMEOUT_MS,
  });
  if (health.status !== "ok") {
    console.error(
      "profile 已保存，但健康探测失败；请修复账号、provider 或网络配置后重试 " +
        "(Profile was saved, but the health check failed. Fix the account, provider, or network configuration and retry).",
    );
  }
}

module.exports = {
  initCurrentProfile,
};
