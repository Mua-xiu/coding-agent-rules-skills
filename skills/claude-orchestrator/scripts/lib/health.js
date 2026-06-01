const { spawnSync } = require("child_process");

const {
  DEFAULT_HEALTH_TTL_MS,
  HEALTH_FILE,
  HEALTH_PROMPT,
  ISOLATED_SETTING_SOURCES,
} = require("./constants");
const { safeReadJson, writeJsonAtomic } = require("./fs-json");
const {
  findProfiles,
  profilePath,
  resolveProfileSettings,
  summarizeSettings,
} = require("./profile-store");

/**
 * 判断健康状态是否仍在 TTL 内，可以避免重复 ping。
 */
function isReusableHealth(health, now = Date.now()) {
  if (!health || health.status !== "ok" || !health.last_ping_at) return false;
  const lastPingAt = Date.parse(health.last_ping_at);
  return Number.isFinite(lastPingAt) && now - lastPingAt <= DEFAULT_HEALTH_TTL_MS;
}

/**
 * 限制错误文本长度，防止上游输出把 health.json 撑得过大。
 */
function truncateText(value, limit = 2000) {
  if (!value) return "";
  const text = String(value).trim();
  return text.length <= limit ? text : `${text.slice(0, limit)}...`;
}

/**
 * 将一次 Claude CLI 探测结果写入 profile 独立 health.json。
 */
function writeHealth(options, profile, result) {
  const healthPath = profilePath(options, profile, HEALTH_FILE);
  const previous = safeReadJson(healthPath);
  const failures = result.status === "ok" ? 0 : (previous?.consecutive_failures || 0) + 1;
  const health = {
    status: result.status,
    last_ping_at: new Date().toISOString(),
    latency_ms: result.latencyMs,
    model: result.model,
    error_code: result.errorCode,
    error_message_raw: result.errorMessageRaw,
    error_message_zh: result.errorMessageZh,
    consecutive_failures: failures,
  };
  writeJsonAtomic(healthPath, health);
  return health;
}

/**
 * 执行轻量 Claude CLI 探测，并更新 profile 健康状态。
 */
function pingProfile(options, profile, { forceRefresh = false, timeoutMs = options.pingTimeoutMs } = {}) {
  const settingsPath = resolveProfileSettings(options, profile);
  const healthPath = profilePath(options, profile, HEALTH_FILE);
  const existingHealth = safeReadJson(healthPath);
  if (!forceRefresh && isReusableHealth(existingHealth)) {
    console.log(`复用健康状态 (Reusing cached health)：${profile} status=ok`);
    return existingHealth;
  }

  const settings = summarizeSettings(settingsPath);
  const startedAt = Date.now();
  const command = process.env.CLAUDE_BIN || "claude";
  const args = [
    "-p",
    HEALTH_PROMPT,
    "--settings",
    settingsPath,
    "--setting-sources",
    ISOLATED_SETTING_SOURCES,
    "--output-format",
    "text",
    "--permission-mode",
    "dontAsk",
    "--effort",
    "low",
    "--tools",
    "",
    "--no-session-persistence",
  ];
  const commandResult = spawnSync(command, args, {
    encoding: "utf8",
    timeout: timeoutMs,
    windowsHide: true,
  });
  const latencyMs = Date.now() - startedAt;
  const stdout = truncateText(commandResult.stdout);
  const stderr = truncateText(commandResult.stderr);
  const rawOutput = truncateText([stdout, stderr].filter(Boolean).join("\n"));

  let result;
  if (commandResult.error && commandResult.error.code === "ETIMEDOUT") {
    result = {
      status: "down",
      latencyMs,
      model: settings.model,
      errorCode: "PING_TIMEOUT",
      errorMessageRaw: rawOutput || commandResult.error.message,
      errorMessageZh: `健康探测超过 ${timeoutMs}ms，已终止本次探测。`,
    };
  } else if (commandResult.error) {
    result = {
      status: "down",
      latencyMs,
      model: settings.model,
      errorCode: commandResult.error.code || "CLAUDE_COMMAND_ERROR",
      errorMessageRaw: rawOutput || commandResult.error.message,
      errorMessageZh: "无法启动 Claude CLI，请检查 claude 命令是否已安装并可执行。",
    };
  } else if (commandResult.status !== 0) {
    result = {
      status: "down",
      latencyMs,
      model: settings.model,
      errorCode: `CLAUDE_EXIT_${commandResult.status}`,
      errorMessageRaw: rawOutput,
      errorMessageZh: "Claude CLI 返回非零退出码，请检查账号、provider 或网络配置。",
    };
  } else if (stdout.toLowerCase() !== "ok") {
    result = {
      status: "down",
      latencyMs,
      model: settings.model,
      errorCode: "UNEXPECTED_RESPONSE",
      errorMessageRaw: rawOutput,
      errorMessageZh: "Claude CLI 未返回预期的单词 ok，请检查 provider 响应。",
    };
  } else {
    result = {
      status: "ok",
      latencyMs,
      model: settings.model,
      errorCode: null,
      errorMessageRaw: null,
      errorMessageZh: null,
    };
  }

  const health = writeHealth(options, profile, result);
  if (health.status === "ok") {
    console.log(`健康探测成功 (Health check passed)：${profile} latency_ms=${health.latency_ms}`);
  } else {
    console.error(
      `健康探测失败 (Health check failed)：${profile} code=${health.error_code}\n` +
        `${health.error_message_zh}\n` +
        `原始错误 (Raw error)：${health.error_message_raw || "<empty>"}`,
    );
  }
  return health;
}

/**
 * 逐个探测全部 profile；单个失败不会中断其余账号检查。
 */
function pingAllProfiles(options, forceRefresh) {
  const profiles = findProfiles(options);
  if (profiles.length === 0) {
    console.log(`未找到 Claude profile (No Claude profiles found)：${options.profilesRoot}`);
    return;
  }

  let hasFailure = false;
  for (const profile of profiles) {
    const health = pingProfile(options, profile, { forceRefresh });
    if (health.status !== "ok") hasFailure = true;
  }
  if (hasFailure) process.exitCode = 1;
}

module.exports = {
  pingAllProfiles,
  pingProfile,
};
