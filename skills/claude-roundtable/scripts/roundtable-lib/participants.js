const path = require("path");
const { spawnSync } = require("child_process");
const crypto = require("crypto");

const { HEALTH_FILE } = require("../lib/constants");
const { safeReadJson } = require("../lib/fs-json");
const { isReusableHealth, pingProfile } = require("../lib/health");
const { findProfiles, profilePath, validateProfileName } = require("../lib/profile-store");

const SWITCH_API = path.resolve(__dirname, "..", "switch-api.js");

/**
 * 根据 CLI 参数选择参与者；真实运行时必须经过 TTL 感知的共享健康探测。
 */
function selectParticipants(options, runId) {
  const availableProfiles = findProfiles(options);
  const requestedProfiles = parseProfileSpec(options.profiles, availableProfiles);
  const failures = [];
  const warnings = [];
  const candidates = [];

  if (requestedProfiles.length === 0) {
    failures.push(
      buildFailure(
        "<all>",
        "NO_PROFILES_FOUND",
        "未找到任何可参与讨论的 profile。",
        "No profiles were found for roundtable participation.",
      ),
    );
  }

  for (const profile of requestedProfiles) {
    if (!availableProfiles.includes(profile)) {
      failures.push(buildFailure(profile, "PROFILE_NOT_FOUND", "未找到该 profile。", "Profile was not found."));
      continue;
    }

    validateProfileName(profile);
    const health = resolveUsableHealth(options, profile, failures, warnings);
    if (!health || health.status !== "ok") continue;

    candidates.push({
      name: profile,
      sessionId: crypto.randomUUID(),
      settingsPath: resolveSettingsPath(options, profile),
      healthStatus: health.status,
      healthLastPingAt: health.last_ping_at || null,
      started: false,
      failed: false,
    });
  }

  const participants = candidates.slice(0, options.maxParticipants);
  const standbyParticipants = candidates.slice(options.maxParticipants);

  return { participants, standbyParticipants, failures, warnings };
}

/**
 * 真实运行调用共享 pingProfile，让过期 ok 状态按 TTL 自动重测；dry-run 只读本地状态不消耗额度。
 */
function resolveUsableHealth(options, profile, failures, warnings) {
  if (!options.dryRun) {
    const health = pingProfile(options, profile);
    if (health.status !== "ok") {
      failures.push(
        buildFailure(
          profile,
          health.error_code || "HEALTH_DOWN",
          health.error_message_zh || "profile 健康探测未通过。",
          health.error_message_raw || "Profile health check did not pass.",
        ),
      );
      return null;
    }
    return health;
  }

  const health = safeReadJson(profilePath(options, profile, HEALTH_FILE));
  if (health && health.status === "down") {
    failures.push(
      buildFailure(
        profile,
        health.error_code || "HEALTH_DOWN",
        health.error_message_zh || "profile 最近一次健康状态为 down。",
        health.error_message_raw || "Profile health status is down.",
      ),
    );
    return null;
  }
  if (health && isReusableHealth(health)) return health;

  warnings.push(
    buildFailure(
      profile,
      "HEALTH_NOT_VERIFIED_IN_DRY_RUN",
      "dry-run 未执行健康探测，profile 仅作为运行计划参与。",
      "Dry-run does not perform health checks; this profile is included for planning only.",
    ),
  );
  return {
    status: "ok",
    last_ping_at: health?.last_ping_at || null,
  };
}

/**
 * 解析 --profiles；all 表示从 profilesRoot 自动发现。
 */
function parseProfileSpec(spec, availableProfiles) {
  if (!spec || spec === "all") return availableProfiles;
  return spec
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * 通过共享 switch-api.js 解析 settings 路径，避免 roundtable 自己维护第二套路径协议。
 */
function resolveSettingsPath(options, profile) {
  const args = [SWITCH_API, "--settings-path", profile, "--profiles-root", options.profilesRoot];
  const result = spawnSync(process.execPath, args, {
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.error) {
    throw new Error(`无法解析 profile settings (Failed to resolve profile settings)：${profile}\n${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(
      `无法解析 profile settings (Failed to resolve profile settings)：${profile}\n${result.stderr || result.stdout}`,
    );
  }
  return result.stdout.trim();
}

/**
 * 构造可写入 failures.json 的双语失败对象。
 */
function buildFailure(profile, code, zh, raw) {
  return {
    profile,
    error_code: code,
    error_message_zh: zh,
    error_message_raw: raw,
  };
}

module.exports = {
  buildFailure,
  selectParticipants,
};
