#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");

const HOME = os.homedir();
const CLAUDE_DIR = path.join(HOME, ".claude");
const DEFAULT_PROFILES_ROOT = path.join(CLAUDE_DIR, "profiles");
const ACTIVE_MARKER = path.join(CLAUDE_DIR, "active-profile.json");
const BACKUP_ROOT = path.join(CLAUDE_DIR, "profile-switch-backups");

const MANAGED_FILES = [
  {
    label: "settings.json",
    profilePath: "settings.json",
    livePath: path.join(CLAUDE_DIR, "settings.json"),
    required: true,
  },
  {
    label: ".claude.json",
    profilePath: ".claude.json",
    livePath: path.join(HOME, ".claude.json"),
    required: false,
  },
];

function parseArgs(argv) {
  const options = {
    profile: null,
    profilesRoot: DEFAULT_PROFILES_ROOT,
    dryRun: false,
    noBackup: false,
    force: false,
    list: false,
    status: false,
    initCurrent: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--profiles-root") {
      options.profilesRoot = resolveUserPath(requireValue(argv, ++index, arg));
    } else if (arg === "--init-current") {
      options.initCurrent = requireValue(argv, ++index, arg);
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
      fail(`未知参数：${arg}`);
    } else if (!options.profile) {
      options.profile = arg;
    } else {
      fail(`只能指定一个 profile，收到多余参数：${arg}`);
    }
  }

  options.profilesRoot = resolveUserPath(options.profilesRoot);
  return options;
}

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (!value || value.startsWith("-")) {
    fail(`${flag} 需要一个值`);
  }
  return value;
}

function resolveUserPath(value) {
  if (!value) return value;
  if (value === "~") return HOME;
  if (value.startsWith("~/") || value.startsWith("~\\")) {
    return path.join(HOME, value.slice(2));
  }
  return path.resolve(value);
}

function fail(message) {
  console.error(`[claude-profile-switch] ${message}`);
  process.exit(1);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function safeReadJson(file) {
  if (!fs.existsSync(file)) return null;
  try {
    return readJson(file);
  } catch (error) {
    fail(`JSON 解析失败：${file}\n${error.message}`);
  }
}

function writeJson(file, value) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function profileDir(options, profile) {
  return path.join(options.profilesRoot, profile);
}

function profileFile(options, profile, managedFile) {
  return path.join(profileDir(options, profile), managedFile.profilePath);
}

function validateProfileName(profile) {
  if (!profile || !/^[a-zA-Z0-9._-]+$/.test(profile)) {
    fail("profile 名称只能包含字母、数字、点、下划线和连字符");
  }
}

function validateJsonFile(file) {
  if (!fs.existsSync(file)) return;
  safeReadJson(file);
}

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

function summarizeSettings(settingsPath) {
  const settings = safeReadJson(settingsPath);
  if (!settings) return null;
  return {
    model: settings.model || null,
    effortLevel: settings.effortLevel || null,
    env: redactJson(settings.env || {}),
  };
}

function listProfiles(options) {
  ensureDir(options.profilesRoot);
  const active = safeReadJson(ACTIVE_MARKER);
  const profiles = fs
    .readdirSync(options.profilesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  if (profiles.length === 0) {
    console.log(`未找到 Claude profile。profiles 目录：${options.profilesRoot}`);
    return;
  }

  for (const profile of profiles) {
    const marker = active && active.profile === profile ? "*" : " ";
    const settingsPath = profileFile(options, profile, MANAGED_FILES[0]);
    const summary = summarizeSettings(settingsPath);
    const model = summary && summary.model ? ` model=${summary.model}` : "";
    console.log(`${marker} ${profile}${model}`);
  }
}

function printStatus() {
  const active = safeReadJson(ACTIVE_MARKER);
  const summary = summarizeSettings(path.join(CLAUDE_DIR, "settings.json"));
  console.log(
    JSON.stringify(
      {
        activeProfile: active || null,
        liveSettings: summary,
      },
      null,
      2,
    ),
  );
}

function initCurrentProfile(options, profile) {
  validateProfileName(profile);
  const targetDir = profileDir(options, profile);
  if (fs.existsSync(targetDir) && !options.force) {
    fail(`profile 已存在：${targetDir}\n如需覆盖，请加 --force`);
  }

  if (options.dryRun) {
    console.log(`[dry-run] 将当前 Claude 配置保存为 profile：${profile}`);
    return;
  }

  ensureDir(targetDir);
  const copied = [];
  for (const managedFile of MANAGED_FILES) {
    if (!fs.existsSync(managedFile.livePath)) {
      if (managedFile.required) {
        fail(`缺少必需的 Claude 配置文件：${managedFile.livePath}`);
      }
      continue;
    }
    validateJsonFile(managedFile.livePath);
    const destination = profileFile(options, profile, managedFile);
    ensureDir(path.dirname(destination));
    fs.copyFileSync(managedFile.livePath, destination);
    copied.push(managedFile.label);
  }

  writeJson(path.join(targetDir, "profile-meta.json"), {
    profile,
    createdAt: new Date().toISOString(),
    managedFiles: copied,
    note: "此目录可能包含 Claude/provider 凭据，只应保存在用户目录，不要提交到仓库。",
  });

  console.log(`已从当前 Claude 配置创建 profile：${profile}`);
  console.log(`profile 目录：${targetDir}`);
}

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

function switchProfile(options, profile) {
  validateProfileName(profile);
  const sourceDir = profileDir(options, profile);
  if (!fs.existsSync(sourceDir)) {
    fail(`profile 不存在：${sourceDir}`);
  }

  const filesToSwitch = MANAGED_FILES.filter((managedFile) => {
    const source = profileFile(options, profile, managedFile);
    if (!fs.existsSync(source)) {
      if (managedFile.required) {
        fail(`profile 缺少必需文件：${source}`);
      }
      return false;
    }
    validateJsonFile(source);
    return true;
  });

  if (filesToSwitch.length === 0) {
    fail(`profile 中没有可切换的配置文件：${sourceDir}`);
  }

  if (options.dryRun) {
    console.log(`[dry-run] 将切换到 Claude profile：${profile}`);
    for (const managedFile of filesToSwitch) {
      console.log(`  ${profileFile(options, profile, managedFile)} -> ${managedFile.livePath}`);
    }
    return;
  }

  let backupDir = null;
  if (!options.noBackup) {
    backupDir = backupLiveFiles(filesToSwitch);
  }

  for (const managedFile of filesToSwitch) {
    const source = profileFile(options, profile, managedFile);
    ensureDir(path.dirname(managedFile.livePath));
    fs.copyFileSync(source, managedFile.livePath);
  }

  writeJson(ACTIVE_MARKER, {
    profile,
    switchedAt: new Date().toISOString(),
    profilesRoot: options.profilesRoot,
    files: filesToSwitch.map((file) => file.label),
    backupDir,
  });

  console.log(`已切换 Claude profile：${profile}`);
  if (backupDir) {
    console.log(`切换前配置已备份：${backupDir}`);
  }
  const summary = summarizeSettings(path.join(CLAUDE_DIR, "settings.json"));
  if (summary) {
    console.log(JSON.stringify(summary, null, 2));
  }
}

function printHelp() {
  console.log(`Usage:
  node switch-api.js <profile> [--profiles-root <dir>] [--dry-run] [--no-backup]
  node switch-api.js --init-current <profile> [--force]
  node switch-api.js --list
  node switch-api.js --status

Profiles:
  默认保存在 ~/.claude/profiles/<profile>/。
  每个 profile 至少需要 settings.json，可选包含 .claude.json。
  profile 目录可能包含 token，请不要提交到 git。`);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.list) return listProfiles(options);
  if (options.status) return printStatus();
  if (options.initCurrent) return initCurrentProfile(options, options.initCurrent);
  if (!options.profile) {
    printHelp();
    process.exit(1);
  }
  return switchProfile(options, options.profile);
}

main();
