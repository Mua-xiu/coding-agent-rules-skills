const { spawnSync } = require("child_process");
const crypto = require("crypto");

const { ISOLATED_SETTING_SOURCES } = require("../lib/constants");
const { redactText } = require("./redact");

/**
 * 调用单个 Claude profile；默认禁用工具，避免讨论阶段意外读取或编辑文件。
 */
function runClaudeTurn(participant, prompt, options) {
  if (options.dryRun) {
    return {
      ok: true,
      content: buildDryRunContent(participant, options, prompt),
      dryRun: true,
    };
  }

  const firstResult = runClaudeCommand(participant, prompt, options);
  if (firstResult.ok || firstResult.error_code !== "INVALID_TOOL_CALL_OUTPUT") {
    return firstResult;
  }

  // 某些 provider 会把工具意图直接输出为 XML 标签；换新 session 重试一次，避免污染后续轮次。
  const retryParticipant = {
    ...participant,
    sessionId: crypto.randomUUID(),
    started: false,
  };
  const retryPrompt = [
    prompt,
    "",
    "Correction for retry:",
    "Your previous response emitted tool-call markup instead of a discussion answer.",
    "Do not emit <tool_call>, <tool_calls>, or similar markup. Use available read-only tools internally when needed, then return the requested structured discussion text.",
  ].join("\n");
  const retryResult = runClaudeCommand(retryParticipant, retryPrompt, options);
  return {
    ...retryResult,
    retried_after_invalid_output: true,
    retry_session_id: retryParticipant.sessionId,
  };
}

/**
 * 执行一次 Claude CLI 调用，并拒绝把伪工具调用标签当成有效讨论结论。
 */
function runClaudeCommand(participant, prompt, options) {
  const command = process.env.CLAUDE_BIN || "claude";
  const args = buildClaudeArgs(participant, prompt, options);
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: options.timeoutMs,
    windowsHide: true,
  });

  if (result.error && result.error.code === "ETIMEDOUT") {
    return buildFailure("CLAUDE_TIMEOUT", `Claude 调用超过 ${options.timeoutMs}ms，已终止。`, result.error.message);
  }
  if (result.error) {
    return buildFailure("CLAUDE_COMMAND_ERROR", "无法启动 Claude CLI，请检查 claude 命令。", result.error.message);
  }
  if (result.status !== 0) {
    return buildFailure(
      `CLAUDE_EXIT_${result.status}`,
      "Claude CLI 返回非零退出码，请检查账号、provider 或 prompt。",
      [result.stdout, result.stderr].filter(Boolean).join("\n"),
    );
  }
  const content = redactText(result.stdout.trim());
  if (/<\/?tool_calls?\b/i.test(content)) {
    return buildFailure(
      "INVALID_TOOL_CALL_OUTPUT",
      "Claude 输出了未执行的工具调用标签，未形成有效讨论结论。",
      content,
    );
  }
  return {
    ok: true,
    content,
    session_id: participant.sessionId,
  };
}

/**
 * 拼装 Claude CLI 参数；后续轮次使用 --resume 继续同一参与者 session。
 */
function buildClaudeArgs(participant, prompt, options) {
  const args = [
    "-p",
    prompt,
    "--settings",
    participant.settingsPath,
    "--setting-sources",
    ISOLATED_SETTING_SOURCES,
    "--output-format",
    "text",
    "--permission-mode",
    "dontAsk",
    "--effort",
    options.effort,
    "--tools",
    options.tools,
  ];
  if (options.tools !== "") {
    args.push("--allowedTools", options.tools);
  }
  if (participant.started) {
    args.push("--resume", participant.sessionId);
  } else {
    args.push("--session-id", participant.sessionId);
  }
  for (const dir of options.addDirs) {
    args.push("--add-dir", dir);
  }
  return args;
}

/**
 * dry-run 只记录调用计划，不接触外部模型额度。
 */
function buildDryRunContent(participant, options, prompt) {
  const mode = participant.started ? `--resume ${participant.sessionId}` : `--session-id ${participant.sessionId}`;
  return [
    "[dry-run] Would call Claude with:",
    `profile=${participant.name}`,
    `settings=${participant.settingsPath}`,
    `setting-sources=${ISOLATED_SETTING_SOURCES}`,
    `tools=${options.tools === "" ? "<disabled>" : options.tools}`,
    `read-scopes=${options.readScopes.length > 0 ? options.readScopes.join(", ") : "<none>"}`,
    `session=${mode}`,
    "",
    "Prompt preview:",
    prompt.slice(0, 1200),
  ].join("\n");
}

/**
 * 标准化失败结构，保留原始英文输出并补充中文解释。
 */
function buildFailure(code, zh, raw) {
  return {
    ok: false,
    error_code: code,
    error_message_zh: zh,
    error_message_raw: redactText(raw || ""),
  };
}

module.exports = {
  runClaudeTurn,
};
