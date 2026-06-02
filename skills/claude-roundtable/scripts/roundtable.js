#!/usr/bin/env node

const { parseRoundtableArgs, printHelp } = require("./roundtable-lib/args");
const { runRoundtable } = require("./roundtable-lib/orchestrator");

/**
 * roundtable CLI 薄入口，具体职责拆到 roundtable-lib，避免脚本再次膨胀成单文件。
 */
async function main() {
  const options = parseRoundtableArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }
  await runRoundtable(options);
}

main().catch((error) => {
  console.error(`[claude-roundtable] 错误 (Error)：${error.message}`);
  if (error.details) {
    console.error(`详情 (Details)：${error.details}`);
  }
  process.exit(1);
});
