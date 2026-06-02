const { writeJsonAtomic } = require("../lib/fs-json");
const { pingProfile } = require("../lib/health");
const { runClaudeTurn } = require("./claude-runner");
const { extractDirectedMessages } = require("./directed-messages");
const { selectParticipants, buildFailure } = require("./participants");
const {
  buildCritiquePrompt,
  buildDirectedPrompt,
  buildInitialPrompt,
  buildRevisionPrompt,
} = require("./prompts");
const { createRunPaths } = require("./run-paths");
const { TranscriptWriter } = require("./transcript");

/**
 * 执行完整 roundtable：三段结构化讨论 + 有上限的定向消息路由。
 */
async function runRoundtable(options) {
  const paths = createRunPaths(options);
  const { participants, standbyParticipants, failures, warnings } = selectParticipants(options, paths.runId);
  const writer = new TranscriptWriter(paths, options);
  const state = createInitialState(options, paths, participants, standbyParticipants, failures, warnings);
  const messages = [];
  const directedQueue = [];

  writer.initialize(participants, failures, standbyParticipants);
  for (const warning of warnings) {
    writer.appendMessage({
      stage: "participant-selection",
      from: "controller",
      type: "warning",
      content: `${warning.profile}: ${warning.error_message_zh}`,
    });
  }
  writer.writeFailures([...failures, ...warnings]);
  writer.writeState(state);

  console.log(`已创建讨论运行目录 (Created roundtable run)：${paths.runDir}`);
  console.log(`参与者 (Participants)：${participants.map((item) => item.name).join(", ")}`);
  if (standbyParticipants.length > 0) {
    console.log(`候补参与者 (Standby participants)：${standbyParticipants.map((item) => item.name).join(", ")}`);
  }
  if (participants.length < 2) {
    markInsufficientParticipants({
      participants,
      writer,
      state,
      reason: "当前可参与讨论的账号少于 2 个，无法形成有效 roundtable 讨论。",
      rawReason: "Fewer than two usable participants before discussion.",
    });
    return;
  }

  await runStage({
    stage: "initial",
    participants,
    messages,
    directedQueue,
    writer,
    options,
    state,
    standbyParticipants,
    buildPrompt: (participant) => buildInitialPrompt(options.topic, participant, options),
    allowDirected: false,
  });
  if (effectiveParticipants(participants).length < 2) {
    markInsufficientParticipants({
      participants,
      writer,
      state,
      reason: "首轮结束后有效参与者少于 2 个，已中断；单账号输出不能形成高质量 roundtable 讨论。",
      rawReason: "Fewer than two effective participants after the initial stage.",
    });
    return;
  }

  await runStage({
    stage: "critique",
    participants,
    messages,
    directedQueue,
    writer,
    options,
    state,
    standbyParticipants,
    buildPrompt: (participant) => buildCritiquePrompt(options.topic, participant, messages.filter((item) => item.stage === "initial"), options),
    allowDirected: true,
  });
  await processDirectedQueue({ directedQueue, participants, messages, writer, options, state });

  await runStage({
    stage: "revision",
    participants,
    messages,
    directedQueue,
    writer,
    options,
    state,
    standbyParticipants,
    buildPrompt: (participant) => buildRevisionPrompt(options.topic, participant, messages, options),
    allowDirected: true,
  });
  await processDirectedQueue({ directedQueue, participants, messages, writer, options, state });

  finalizeRun({ participants, writer, state });

  const statusText = state.status === "completed" ? "讨论完成 (Roundtable completed)" : "讨论降级 (Roundtable degraded)";
  console.log(`${statusText}：${paths.runDir}`);
  console.log(`Transcript：${paths.transcriptFile}`);
  console.log("请由 Codex 读取 transcript 后完成最终裁决 (Codex must read the transcript and make the final judgment).");
}

/**
 * 逐参与者运行一个阶段；单个 profile 失败不会中断其它参与者。
 */
async function runStage(context) {
  const { stage, participants, standbyParticipants, messages, writer, options, state, buildPrompt, allowDirected, directedQueue } = context;
  state.current_stage = stage;
  writer.writeState(state);
  console.log(`开始阶段 (Starting stage)：${stage}`);

  for (let index = 0; index < participants.length; index += 1) {
    const participant = participants[index];
    if (participant.failed) continue;
    const result = runClaudeTurn(participant, buildPrompt(participant), options);
    if (result.retried_after_invalid_output) {
      writer.appendMessage({
        stage,
        from: "controller",
        type: "retry",
        content: `${participant.name}: 检测到未执行工具调用标签，已换新 session 重试一次。`,
      });
    }
    if (!result.ok) {
      recordParticipantFailure({ participant, result, stage, writer, options, state });
      if (stage === "initial") {
        activateStandbyParticipant({ failedParticipant: participant, participants, standbyParticipants, writer, state });
      }
      continue;
    }

    participant.sessionId = result.retry_session_id || result.session_id || participant.sessionId;
    participant.started = true;
    syncParticipantState(state, participant);
    const message = writer.appendMessage({
      stage,
      from: participant.name,
      type: result.dryRun ? "dry-run" : "response",
      content: result.content,
    });
    messages.push(message);
    state.messages_count = messages.length;
    writer.writeState(state);

    if (allowDirected) {
      directedQueue.push(...extractDirectedMessages(result.content, participant.name, activeParticipants(participants)));
    }
  }
}

/**
 * 路由参与者发出的定向消息，并用 maxDirectedTurns 防止无限追问。
 */
async function processDirectedQueue(context) {
  const { directedQueue, participants, messages, writer, options, state } = context;
  while (directedQueue.length > 0 && state.directed_turns_used < options.maxDirectedTurns) {
    const directedMessage = directedQueue.shift();
    const target = participants.find((item) => item.name === directedMessage.to && !item.failed);
    if (!target) continue;

    state.current_stage = "directed";
    state.directed_turns_used += 1;
    writer.writeState(state);

    const result = runClaudeTurn(
      target,
      buildDirectedPrompt(options.topic, target, directedMessage, messages, options),
      options,
    );
    if (result.retried_after_invalid_output) {
      writer.appendMessage({
        stage: "directed",
        from: "controller",
        type: "retry",
        content: `${target.name}: 检测到未执行工具调用标签，已换新 session 重试一次。`,
      });
    }
    if (!result.ok) {
      const failure = recordParticipantFailure({
        participant: target,
        result,
        stage: "directed",
        writer,
        options,
        state,
        appendMessage: false,
      });
      writer.appendMessage({
        stage: "directed",
        from: directedMessage.from,
        to: target.name,
        type: directedMessage.type,
        error: true,
        error_message_zh: failure.error_message_zh,
        error_message_raw: failure.error_message_raw,
      });
      writer.writeState(state);
      continue;
    }

    target.sessionId = result.retry_session_id || result.session_id || target.sessionId;
    target.started = true;
    syncParticipantState(state, target);
    const routed = writer.appendMessage({
      stage: "directed",
      from: target.name,
      to: directedMessage.from,
      type: "response",
      content: result.content,
    });
    messages.push(routed);
    state.messages_count = messages.length;
    writer.writeState(state);
    directedQueue.push(...extractDirectedMessages(result.content, target.name, activeParticipants(participants)));
  }

  if (directedQueue.length > 0) {
    writer.appendMessage({
      stage: "directed",
      from: "controller",
      type: "limit",
      content: `已达到 --max-directed-turns=${options.maxDirectedTurns}，剩余定向消息未继续路由。`,
    });
    state.directed_messages_dropped = directedQueue.length;
    directedQueue.length = 0;
    writer.writeState(state);
  }
}

/**
 * 初始化 controller 状态，记录 session-id 和参与者健康状态。
 */
function createInitialState(options, paths, participants, standbyParticipants, failures, warnings) {
  return {
    status: "running",
    run_id: paths.runId,
    started_at: new Date().toISOString(),
    run_dir: paths.runDir,
    topic: options.topic,
    options: {
      profiles: options.profiles,
      max_participants: options.maxParticipants,
      max_directed_turns: options.maxDirectedTurns,
      effort: options.effort,
      tools: options.tools === "" ? "<disabled>" : options.tools,
      read_scopes: options.readScopes,
      discussion_mode: options.discussionMode,
      codex_brief_provided: Boolean(options.codexBrief),
      dry_run: options.dryRun,
    },
    codex_brief: options.codexBrief || null,
    participants: participants.map(toStateParticipant),
    standby_participants: standbyParticipants.map((item) => item.name),
    failures: [...failures, ...warnings],
    current_stage: "initializing",
    messages_count: 0,
    directed_turns_used: 0,
    directed_messages_dropped: 0,
  };
}

/**
 * 参与者不足时保留运行记录并退出，避免把单账号流程误报成完整讨论。
 */
function markInsufficientParticipants({ participants, writer, state, reason, rawReason }) {
  const usableParticipants = participants.filter((item) => !item.failed).map((item) => item.name);
  state.status = "insufficient_participants";
  state.completed_at = new Date().toISOString();
  state.usable_participants = usableParticipants;
  state.effective_participants = effectiveParticipants(participants);
  const failure = buildFailure(
    "controller",
    "INSUFFICIENT_PARTICIPANTS",
    reason,
    rawReason || "Fewer than two participants were available.",
  );
  state.failures.push(failure);
  writer.appendMessage({
    stage: "participant-selection",
    from: "controller",
    type: "failure",
    error: true,
    error_message_zh: `${reason} 当前可用：${usableParticipants.join(", ") || "<none>"}；首轮有效：${state.effective_participants.join(", ") || "<none>"}`,
    error_message_raw: failure.error_message_raw,
  });
  writer.writeState(state);
  writer.writeFailures(state.failures);
  console.error(`${reason} (Fewer than two usable/effective participants).`);
  process.exitCode = 1;
}

/**
 * 记录单个参与者失败；真实调用失败后强制刷新一次健康状态。
 */
function recordParticipantFailure({ participant, result, stage, writer, options, state, appendMessage = true }) {
  participant.failed = true;
  const refreshedHealth = refreshHealthAfterFailure(participant, options);
  const failure = buildFailure(
    participant.name,
    result.error_code,
    result.error_message_zh,
    result.error_message_raw,
  );
  if (refreshedHealth) {
    failure.health_status_after_failure = refreshedHealth.status;
    failure.health_error_code_after_failure = refreshedHealth.error_code || null;
  }
  state.failures.push(failure);
  syncParticipantState(state, participant);
  writer.writeFailures(state.failures);
  if (appendMessage) {
    writer.appendMessage({
      stage,
      from: participant.name,
      type: "failure",
      error: true,
      error_message_zh: failure.error_message_zh,
      error_message_raw: failure.error_message_raw,
    });
  }
  writer.writeState(state);
  return failure;
}

/**
 * 实际轮次失败后刷新健康状态，方便下一次运行不再复用过期 ok。
 */
function refreshHealthAfterFailure(participant, options) {
  if (options.dryRun) return null;
  try {
    const health = pingProfile(options, participant.name, { forceRefresh: true });
    participant.healthStatus = health.status;
    participant.healthLastPingAt = health.last_ping_at || null;
    return health;
  } catch (error) {
    participant.healthStatus = "unknown";
    return {
      status: "unknown",
      error_code: "HEALTH_REFRESH_ERROR",
      error_message_raw: error.message,
    };
  }
}

/**
 * 首轮失败时从候补队列补位，保证 max-participants 是并发上限而不是一次性截断。
 */
function activateStandbyParticipant({ failedParticipant, participants, standbyParticipants, writer, state }) {
  const replacement = standbyParticipants.shift();
  state.standby_participants = standbyParticipants.map((item) => item.name);
  if (!replacement) {
    writer.writeState(state);
    return;
  }
  participants.push(replacement);
  state.participants.push(toStateParticipant(replacement));
  writer.appendMessage({
    stage: "participant-selection",
    from: "controller",
    type: "replacement",
    content: `${failedParticipant.name} 首轮失败，已启用候补参与者 ${replacement.name}。`,
  });
  writer.writeState(state);
}

/**
 * 完成运行时按有效参与者数量决定 completed 还是 degraded。
 */
function finalizeRun({ participants, writer, state }) {
  const effective = effectiveParticipants(participants);
  state.effective_participants = effective;
  state.status = effective.length >= 2 ? "completed" : "degraded";
  state.completed_at = new Date().toISOString();
  writer.writeState(state);
  writer.writeFailures(state.failures);
  if (state.status !== "completed") {
    writer.appendMessage({
      stage: "finalize",
      from: "controller",
      type: "degraded",
      content: `有效参与者少于 2 个，本次只能作为降级讨论记录：${effective.join(", ") || "<none>"}`,
    });
    process.exitCode = 1;
  }
}

/**
 * 有效参与者必须真实完成至少一轮输出；单账号不进入互评/修订。
 */
function effectiveParticipants(participants) {
  return participants
    .filter((item) => !item.failed && item.started)
    .map((item) => item.name);
}

/**
 * 将运行时参与者状态同步回 state.json，便于 Codex 直接判断失败和补位。
 */
function syncParticipantState(state, participant) {
  const entry = state.participants.find((item) => item.name === participant.name);
  if (!entry) return;
  entry.session_id = participant.sessionId;
  entry.health_status = participant.healthStatus;
  entry.health_last_ping_at = participant.healthLastPingAt;
  entry.started = participant.started;
  entry.failed = participant.failed;
}

/**
 * state.json 中的参与者摘要，不写入敏感 settings 内容。
 */
function toStateParticipant(item) {
  return {
    name: item.name,
    session_id: item.sessionId,
    health_status: item.healthStatus,
    health_last_ping_at: item.healthLastPingAt || null,
    settings_path: item.settingsPath,
    started: item.started,
    failed: item.failed,
  };
}

/**
 * 只返回尚未失败的参与者，供 directed message 目标校验使用。
 */
function activeParticipants(participants) {
  return participants.filter((item) => !item.failed);
}

module.exports = {
  runRoundtable,
};
