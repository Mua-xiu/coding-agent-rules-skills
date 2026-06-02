const fs = require("fs");

const { writeJsonAtomic } = require("../lib/fs-json");
const { redactJson, redactText } = require("./redact");

/**
 * 负责所有运行记录写入，保证 Codex 后续只需要读取固定几个产物。
 */
class TranscriptWriter {
  constructor(paths, options) {
    this.paths = paths;
    this.options = options;
    this.messageIndex = 0;
  }

  /**
   * 初始化可读 transcript，记录主题、权限边界和运行目录。
   */
  initialize(participants, skippedProfiles, standbyParticipants = []) {
    const header = [
      "# Claude Roundtable Transcript",
      "",
      `- Run ID: ${this.paths.runId}`,
      `- Started At: ${new Date().toISOString()}`,
      `- Workspace: ${process.cwd()}`,
      `- Discussion Mode: ${this.options.discussionMode}`,
      `- Tools: ${this.options.tools === "" ? "disabled" : this.options.tools}`,
      `- Read Scopes: ${this.options.readScopes.length > 0 ? this.options.readScopes.join(", ") : "<none>"}`,
      `- Codex Baseline: ${this.options.codexBrief ? "provided" : "<none>"}`,
      `- Max Directed Turns: ${this.options.maxDirectedTurns}`,
      `- Participants: ${participants.map((item) => item.name).join(", ")}`,
      `- Standby Participants: ${standbyParticipants.map((item) => item.name).join(", ") || "<none>"}`,
      "",
      "## Topic",
      "",
      redactText(this.options.topic),
      "",
    ];
    if (skippedProfiles.length > 0) {
      header.push("## Skipped Profiles", "");
      for (const failure of skippedProfiles) {
        header.push(`- ${failure.profile}: ${failure.error_message_zh} (${failure.error_code})`);
      }
      header.push("");
    }
    if (this.options.codexBrief) {
      header.push("## Codex Baseline", "");
      header.push(redactText(this.options.codexBrief), "");
    }
    fs.writeFileSync(this.paths.transcriptFile, `${header.join("\n")}\n`, "utf8");
    fs.writeFileSync(this.paths.messagesFile, "", "utf8");
  }

  /**
   * 追加一条模型、控制器或失败消息。
   */
  appendMessage(message) {
    this.messageIndex += 1;
    const entry = redactJson({
      id: this.messageIndex,
      timestamp: new Date().toISOString(),
      ...message,
    });
    if (typeof entry.content === "string") entry.content = redactText(entry.content);
    fs.appendFileSync(this.paths.messagesFile, `${JSON.stringify(entry)}\n`, "utf8");
    this.appendTranscriptEntry(entry);
    return entry;
  }

  /**
   * 写入 controller 当前状态，使用原子替换避免半写入文件。
   */
  writeState(state) {
    writeJsonAtomic(this.paths.stateFile, redactJson(state));
  }

  /**
   * 写入失败参与者列表，便于 Codex 最终告知用户。
   */
  writeFailures(failures) {
    writeJsonAtomic(this.paths.failuresFile, redactJson(failures));
  }

  /**
   * 将 JSONL 消息同步成 Markdown，方便人工和 Codex 快速审阅。
   */
  appendTranscriptEntry(entry) {
    const title = [
      "##",
      entry.stage || "controller",
      entry.from ? `- ${entry.from}` : "",
      entry.to ? `-> ${entry.to}` : "",
    ]
      .filter(Boolean)
      .join(" ");
    const body = entry.error
      ? `错误 (Error)：${entry.error_message_zh || entry.error}\n\n原始错误 (Raw error)：${entry.error_message_raw || ""}`
      : entry.content || "";
    fs.appendFileSync(
      this.paths.transcriptFile,
      `${title}\n\n${redactText(body)}\n\n`,
      "utf8",
    );
  }
}

module.exports = {
  TranscriptWriter,
};
