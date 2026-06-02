const fs = require("fs");
const path = require("path");

const { HOME } = require("./constants");
const { fail } = require("./output");

/**
 * 支持将用户输入中的 ~ 展开到当前 HOME。
 */
function resolveUserPath(value) {
  if (!value) return value;
  if (value === "~") return HOME;
  if (value.startsWith("~/") || value.startsWith("~\\")) {
    return path.join(HOME, value.slice(2));
  }
  return path.resolve(value);
}

/**
 * 确保目录存在。
 */
function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * 读取 JSON，并兼容带 BOM 的文件。
 */
function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

/**
 * 在文件不存在时返回 null；文件损坏时明确报错。
 */
function safeReadJson(file) {
  if (!fs.existsSync(file)) return null;
  try {
    return readJson(file);
  } catch (error) {
    fail(`JSON 解析失败 (Failed to parse JSON)：${file}\n${error.message}`);
  }
}

/**
 * 写入普通 JSON 配置文件。
 */
function writeJson(file, value) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

/**
 * 使用临时文件和 rename 原子替换共享状态文件，避免并发读取半写入内容。
 */
function writeJsonAtomic(file, value) {
  ensureDir(path.dirname(file));
  const tempFile = path.join(
    path.dirname(file),
    `.${path.basename(file)}.${process.pid}.${Date.now()}.tmp`,
  );
  try {
    fs.writeFileSync(tempFile, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    fs.renameSync(tempFile, file);
  } finally {
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  }
}

/**
 * 生成适合备份目录使用的时间戳。
 */
function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

module.exports = {
  ensureDir,
  readJson,
  resolveUserPath,
  safeReadJson,
  timestamp,
  writeJson,
  writeJsonAtomic,
};
