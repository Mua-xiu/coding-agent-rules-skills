const crypto = require("crypto");
const path = require("path");

const { ensureDir, timestamp } = require("../lib/fs-json");

/**
 * 创建本次讨论运行目录；默认落在当前工作目录，避免写入 profile 共享状态目录。
 */
function createRunPaths(options) {
  const runId = crypto.randomBytes(3).toString("hex");
  const runDir = options.runDir
    ? path.resolve(options.runDir)
    : path.join(process.cwd(), "roundtable-runs", `${timestamp()}-${runId}`);
  ensureDir(runDir);
  return {
    runId,
    runDir,
    stateFile: path.join(runDir, "state.json"),
    messagesFile: path.join(runDir, "messages.jsonl"),
    transcriptFile: path.join(runDir, "interactive-transcript.md"),
    failuresFile: path.join(runDir, "failures.json"),
  };
}

module.exports = {
  createRunPaths,
};
