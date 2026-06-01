const fs = require("fs");
const path = require("path");

const {
  ACTIVE_MARKER,
  BACKUP_ROOT,
  MANAGED_FILES,
} = require("./constants");
const {
  ensureDir,
  timestamp,
  writeJson,
} = require("./fs-json");
const { fail } = require("./output");
const {
  managedProfileFile,
  profileDir,
  validateJsonFile,
  validateProfileName,
} = require("./profile-store");

/**
 * 备份旧回退模式即将覆盖的 live 配置。
 */
function backupLiveFiles(filesToSwitch) {
  const backupDir = path.join(BACKUP_ROOT, timestamp());
  ensureDir(backupDir);
  const copied = [];

  for (const managedFile of filesToSwitch) {
    if (!fs.existsSync(managedFile.livePath)) continue;
    const relativeName =
      managedFile.label === ".claude.json"
        ? ".claude.json"
        : path.join(".claude", managedFile.label);
    const destination = path.join(backupDir, relativeName);
    ensureDir(path.dirname(destination));
    fs.copyFileSync(managedFile.livePath, destination);
    copied.push(relativeName);
  }

  writeJson(path.join(backupDir, "backup-meta.json"), {
    createdAt: new Date().toISOString(),
    files: copied,
  });
  return backupDir;
}

/**
 * 显式执行旧版全局覆盖流程，仅用于无法使用 --settings 的回退场景。
 */
function switchGlobalProfile(options, profile) {
  validateProfileName(profile);
  const sourceDir = profileDir(options, profile);
  if (!fs.existsSync(sourceDir)) {
    fail(`profile 不存在 (Profile does not exist)：${sourceDir}`);
  }

  const filesToSwitch = MANAGED_FILES.filter((managedFile) => {
    const source = managedProfileFile(options, profile, managedFile);
    if (!fs.existsSync(source)) {
      if (managedFile.required) {
        fail(`profile 缺少必需文件 (Required profile file is missing)：${source}`);
      }
      return false;
    }
    validateJsonFile(source);
    return true;
  });

  if (options.dryRun) {
    console.log(`[dry-run] 将覆盖全局 Claude 配置 (Overwrite global Claude config)：${profile}`);
    for (const managedFile of filesToSwitch) {
      console.log(`  ${managedProfileFile(options, profile, managedFile)} -> ${managedFile.livePath}`);
    }
    return;
  }

  console.warn(
    "警告：正在使用 global-overwrite 回退模式，将修改全局 Claude 配置 " +
      "(Warning: global-overwrite fallback mode will modify global Claude settings).",
  );
  let backupDir = null;
  if (!options.noBackup) {
    backupDir = backupLiveFiles(filesToSwitch);
  }

  for (const managedFile of filesToSwitch) {
    const source = managedProfileFile(options, profile, managedFile);
    ensureDir(path.dirname(managedFile.livePath));
    fs.copyFileSync(source, managedFile.livePath);
  }

  writeJson(ACTIVE_MARKER, {
    profile,
    switchedAt: new Date().toISOString(),
    profilesRoot: options.profilesRoot,
    files: filesToSwitch.map((file) => file.label),
    backupDir,
    mode: "global-overwrite",
  });

  console.log(`已覆盖全局 Claude profile (Overwrote global Claude profile)：${profile}`);
  if (backupDir) {
    console.log(`覆盖前配置已备份 (Previous config backed up)：${backupDir}`);
  }
}

module.exports = {
  switchGlobalProfile,
};
