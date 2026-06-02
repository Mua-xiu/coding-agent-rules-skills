const ALLOWED_TYPES = new Set(["question", "challenge", "answer", "support"]);

/**
 * 从模型回复中解析可选定向消息；解析失败时静默忽略，让讨论主流程保持稳定。
 */
function extractDirectedMessages(content, from, participants) {
  const participantNames = new Set(participants.map((item) => item.name));
  const jsonText = extractJsonBlock(content);
  if (!jsonText) return [];

  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (_error) {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((item) => normalizeDirectedMessage(item, from))
    .filter((item) => item && participantNames.has(item.to) && ALLOWED_TYPES.has(item.type));
}

/**
 * 提取 DIRECTED_MESSAGES_JSON 后的 JSON 数组，兼容 fenced code 和单行 JSON。
 */
function extractJsonBlock(content) {
  if (!content) return null;
  const labelIndex = content.indexOf("DIRECTED_MESSAGES_JSON:");
  if (labelIndex < 0) return null;
  const afterLabel = content.slice(labelIndex + "DIRECTED_MESSAGES_JSON:".length).trim();
  const fenced = afterLabel.match(/^```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const arrayMatch = afterLabel.match(/^\[[\s\S]*\]/);
  return arrayMatch ? arrayMatch[0].trim() : null;
}

/**
 * 标准化模型给出的定向消息，限制消息长度避免后续 prompt 失控。
 */
function normalizeDirectedMessage(item, from) {
  if (!item || typeof item !== "object") return null;
  const to = String(item.to || "").trim();
  const type = String(item.type || "").trim();
  const message = String(item.message || "").trim();
  if (!to || !type || !message) return null;
  return {
    from,
    to,
    type,
    message: message.length > 1200 ? `${message.slice(0, 1200)}...` : message,
  };
}

module.exports = {
  extractDirectedMessages,
};
