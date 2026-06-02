# Roundtable Prompt Patterns

This reference documents the prompts embedded in `scripts/roundtable.js`. Load it only when adjusting the discussion behavior.

## Stage Goals

- `initial`: keep participants independent; do not include other participants' answers.
- `critique`: show first-round answers and ask for risk, weak-evidence, and missing-boundary critique.
- `revision`: show first answers plus critique and ask each participant to revise its recommendation.
- `directed`: route bounded model-to-model messages when participants emit them.

## Required Output Shape

Ask every participant to keep replies concise and structured:

```text
Recommendation:
Evidence:
Risks:
P0-P4 Issues:
Open Questions:
Directed Messages:
```

## Tool Modes

- `text-only`: tools are disabled. Participants must not call tools, output `<tool_call>` / `<tool_calls>` markup, claim to have inspected local files, or request broad repository scans. They must reason only from the topic and label assumptions clearly.
- `scoped-readonly`: triggered by `--read-scope`. Participants may use only `Read`, `Glob`, and `Grep`; they must read only topic-relevant files within the listed scopes, must not modify files, and must not scan unrelated directories.

The controller rejects raw tool-call markup in final text and retries once with a corrected prompt. Codex still reviews the transcript and local facts before accepting any recommendation.

## Codex Baseline

`--codex-brief` / `--codex-brief-file` records Codex's own pre-analysis in state/transcript. It is deliberately not inserted into participant prompts, so participants can still challenge the problem independently. Codex uses the baseline after the discussion to identify drift, missed risks, unsupported claims, and priority inflation.

## Directed Messages Block

Participants may include a machine-readable block only when a direct message is necessary:

````text
DIRECTED_MESSAGES_JSON:
```json
[
  {
    "to": "architect",
    "type": "challenge",
    "message": "Your plan assumes the migration is reversible. What rollback evidence supports that?"
  }
]
```
````

The controller accepts only these message types:

- `question`
- `challenge`
- `answer`
- `support`

The controller ignores invalid targets, invalid types, empty messages, and messages beyond `--max-directed-turns`.
