const SECRET_KEY_PATTERN = /token|secret|password|credential|auth|api[_-]?key/i;

/**
 * 递归隐藏结构化数据里的凭据字段，避免 transcript 或 state 泄漏本机配置。
 */
function redactJson(value) {
  if (Array.isArray(value)) return value.map(redactJson);
  if (!value || typeof value !== "object") return value;

  const result = {};
  for (const [key, child] of Object.entries(value)) {
    if (SECRET_KEY_PATTERN.test(key)) {
      result[key] = child ? "<redacted>" : child;
    } else {
      result[key] = redactJson(child);
    }
  }
  return result;
}

/**
 * 对自由文本做保守脱敏，重点处理常见 token、Bearer 和 Anthropic 环境变量。
 */
function redactText(value) {
  if (value === null || value === undefined) return value;
  return String(value)
    .replace(/(ANTHROPIC_[A-Z0-9_]*(?:TOKEN|KEY|SECRET)[A-Z0-9_]*\s*[=:]\s*)[^\s"'`]+/gi, "$1<redacted>")
    .replace(/(api[_-]?key\s*[=:]\s*)[^\s"'`]+/gi, "$1<redacted>")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/g, "Bearer <redacted>")
    .replace(/sk-[A-Za-z0-9_-]{10,}/g, "sk-<redacted>");
}

module.exports = {
  redactJson,
  redactText,
};
