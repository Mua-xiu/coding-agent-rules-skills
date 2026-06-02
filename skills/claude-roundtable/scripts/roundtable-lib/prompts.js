/**
 * 构建首轮独立回答 prompt；不包含其它模型输出，避免互相带偏。
 */
function buildInitialPrompt(topic, participant, options) {
  return [
    `You are participant "${participant.name}" in a Codex-moderated multi-profile discussion.`,
    "",
    "Task:",
    "Give your independent first answer to the topic below. Do not assume you have inspected local files unless the topic explicitly provides file contents.",
    "",
    discussionBoundaryInstructions(options),
    "",
    "Topic:",
    topic,
    "",
    baseOutputInstructions(),
    "Do not include DIRECTED_MESSAGES_JSON in this first independent answer.",
  ].join("\n");
}

/**
 * 构建互评 prompt，要求参与者审查其它观点的证据、风险和遗漏。
 */
function buildCritiquePrompt(topic, participant, initialMessages, options) {
  return [
    `You are participant "${participant.name}" in a Codex-moderated multi-profile discussion.`,
    "",
    "Task:",
    "Critique the other participants' first answers. Identify weak evidence, risky assumptions, missing boundaries, and over-design. You may also challenge your own first answer if needed.",
    "",
    discussionBoundaryInstructions(options),
    "",
    "Topic:",
    topic,
    "",
    "First answers:",
    formatMessages(initialMessages),
    "",
    baseOutputInstructions(),
    directedMessageInstructions(),
  ].join("\n");
}

/**
 * 构建修正 prompt，让参与者基于首轮和互评给出更新后的建议。
 */
function buildRevisionPrompt(topic, participant, priorMessages, options) {
  return [
    `You are participant "${participant.name}" in a Codex-moderated multi-profile discussion.`,
    "",
    "Task:",
    "Revise your recommendation after considering the discussion so far. Keep it practical and bounded. Explicitly separate evidence from speculation.",
    "",
    discussionBoundaryInstructions(options),
    "",
    "Topic:",
    topic,
    "",
    "Discussion so far:",
    formatMessages(priorMessages),
    "",
    baseOutputInstructions(),
    directedMessageInstructions(),
  ].join("\n");
}

/**
 * 构建定向消息 prompt，用于模型之间的 bounded 问答或质疑。
 */
function buildDirectedPrompt(topic, participant, directedMessage, contextMessages, options) {
  return [
    `You are participant "${participant.name}" in a Codex-moderated multi-profile discussion.`,
    "",
    "Task:",
    `Respond to this directed ${directedMessage.type} from "${directedMessage.from}". Answer only what is needed to advance the decision.`,
    "",
    discussionBoundaryInstructions(options),
    "",
    "Topic:",
    topic,
    "",
    "Directed message:",
    directedMessage.message,
    "",
    "Recent context:",
    formatMessages(contextMessages.slice(-6)),
    "",
    baseOutputInstructions(),
    directedMessageInstructions(),
  ].join("\n");
}

/**
 * 根据讨论模式约束模型：纯文本时禁止伪工具调用，只读模式时限制调查范围。
 */
function discussionBoundaryInstructions(options) {
  if (options.tools === "") {
    return [
      "Discussion boundary:",
      "- Tools are disabled for this discussion.",
      "- Do not call tools, emit <tool_call> or <tool_calls> markup, claim to have read local files, or request a broad repository scan.",
      "- Base your answer only on facts included in the topic and clearly label any assumptions.",
      "- Do not modify files or propose edits outside the topic boundary.",
    ].join("\n");
  }

  return [
    "Discussion boundary:",
    `- This is a read-only repository discussion. You may use only: ${options.tools}.`,
    "- Read only files directly needed for the topic. Do not edit, write, delete, or run shell commands.",
    "- Do not scan unrelated directories or enumerate the entire repository when the listed scopes are sufficient.",
    "- Allowed read scopes:",
    ...options.readScopes.map((scope) => `  - ${scope}`),
    "- Use tools internally when necessary, then return structured discussion text. Do not emit raw <tool_call> or <tool_calls> markup.",
  ].join("\n");
}

/**
 * 统一输出结构，降低 Codex 读取 transcript 时的整理成本。
 */
function baseOutputInstructions() {
  return [
    "Return concise structured output with these sections:",
    "- Recommendation",
    "- Evidence",
    "- Risks",
    "- P0-P4 Issues",
    "- Open Questions",
  ].join("\n");
}

/**
 * 告知模型如何发起有限定向消息；控制器会验证目标、类型和数量。
 */
function directedMessageInstructions() {
  return [
    "If a direct message is necessary, append this optional machine-readable block:",
    "DIRECTED_MESSAGES_JSON:",
    "```json",
    "[",
    "  {",
    '    "to": "profile-name",',
    '    "type": "question|challenge|answer|support",',
    '    "message": "short bounded message"',
    "  }",
    "]",
    "```",
    "Only include this block when it materially changes the decision.",
  ].join("\n");
}

/**
 * 将历史消息压成 prompt 上下文，避免把 JSONL 元数据直接塞给模型。
 */
function formatMessages(messages) {
  return messages
    .map((message) => {
      const heading = `[${message.stage}] ${message.from || "controller"}${message.to ? ` -> ${message.to}` : ""}`;
      return `${heading}\n${message.content || message.error_message_zh || ""}`;
    })
    .join("\n\n---\n\n");
}

module.exports = {
  buildCritiquePrompt,
  buildDirectedPrompt,
  buildInitialPrompt,
  buildRevisionPrompt,
};
