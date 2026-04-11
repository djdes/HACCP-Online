# Subagent Dispatcher Template

Use this file when you want to run more task units than the environment allows in parallel. The current practical pattern is a 6-slot active pool rotated across 20 task IDs in 4 waves.

## Operating model

- Active slot limit: `6`
- Total staged tasks in this template: `20`
- Waves: `4`
- Wave layout: `6 + 6 + 6 + 2`

## Slot roster

| Slot | Suggested model | Responsibility |
| --- | --- | --- |
| `S1` | `gpt-5.4` | Hard reasoning, ambiguous tasks, arbitration |
| `S2` | `gpt-5.4` | Hard reasoning, second deep branch |
| `S3` | `gpt-5.3-codex` | Code-oriented execution or technical drafting |
| `S4` | `gpt-5.3-codex-spark` | Fast first-pass work, triage, classification |
| `S5` | `gpt-5.4-mini` | Lightweight support, summarization, formatting |
| `S6` | `gpt-5.4-mini` | Lightweight support, verification notes, cleanup |

## Wave plan

| Wave | Active tasks |
| --- | --- |
| `W1` | `T01 T02 T03 T04 T05 T06` |
| `W2` | `T07 T08 T09 T10 T11 T12` |
| `W3` | `T13 T14 T15 T16 T17 T18` |
| `W4` | `T19 T20` |

## Task registry

Fill this table before starting a run.

| Task ID | Wave | Slot | Model | Prompt / goal | Status | Result | Risks | Next |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `T01` | `W1` | `S1` | `gpt-5.4` |  | `queued` |  |  |  |
| `T02` | `W1` | `S2` | `gpt-5.4` |  | `queued` |  |  |  |
| `T03` | `W1` | `S3` | `gpt-5.3-codex` |  | `queued` |  |  |  |
| `T04` | `W1` | `S4` | `gpt-5.3-codex-spark` |  | `queued` |  |  |  |
| `T05` | `W1` | `S5` | `gpt-5.4-mini` |  | `queued` |  |  |  |
| `T06` | `W1` | `S6` | `gpt-5.4-mini` |  | `queued` |  |  |  |
| `T07` | `W2` | `S1` | `gpt-5.4` |  | `queued` |  |  |  |
| `T08` | `W2` | `S2` | `gpt-5.4` |  | `queued` |  |  |  |
| `T09` | `W2` | `S3` | `gpt-5.3-codex` |  | `queued` |  |  |  |
| `T10` | `W2` | `S4` | `gpt-5.3-codex-spark` |  | `queued` |  |  |  |
| `T11` | `W2` | `S5` | `gpt-5.4-mini` |  | `queued` |  |  |  |
| `T12` | `W2` | `S6` | `gpt-5.4-mini` |  | `queued` |  |  |  |
| `T13` | `W3` | `S1` | `gpt-5.4` |  | `queued` |  |  |  |
| `T14` | `W3` | `S2` | `gpt-5.4` |  | `queued` |  |  |  |
| `T15` | `W3` | `S3` | `gpt-5.3-codex` |  | `queued` |  |  |  |
| `T16` | `W3` | `S4` | `gpt-5.3-codex-spark` |  | `queued` |  |  |  |
| `T17` | `W3` | `S5` | `gpt-5.4-mini` |  | `queued` |  |  |  |
| `T18` | `W3` | `S6` | `gpt-5.4-mini` |  | `queued` |  |  |  |
| `T19` | `W4` | `S1` | `gpt-5.4` |  | `queued` |  |  |  |
| `T20` | `W4` | `S2` | `gpt-5.4` |  | `queued` |  |  |  |

## Standard subagent reply format

Ask each subagent to reply in this exact structure:

```text
TASK_ID: T07
SLOT: S1
MODEL: gpt-5.4
STATUS: DONE
RESULT: One short summary of what was produced.
RISKS: Key uncertainty or blocker, if any.
NEXT: Recommended follow-up action.
```

## Run procedure

1. Fill in the `Prompt / goal` column for all task IDs.
2. Start only the current wave's tasks.
3. Wait for all active slots in that wave to finish.
4. Copy each result into the registry before reusing the slot.
5. Close or reuse the finished agents for the next wave.
6. Continue until all rows are marked `done`, `blocked`, or `dropped`.

## Status vocabulary

- `queued`: task is defined but not yet started
- `running`: task is currently assigned to a live slot
- `done`: task completed with a usable output
- `blocked`: task stopped on an external dependency or ambiguity
- `dropped`: task intentionally canceled

## Notes

- The 6-slot cap is treated as a hard platform limit.
- Reusing stable slot IDs keeps the operator view simple even when agent IDs change between waves.
- If one wave contains uneven task complexity, keep the slot assignment table stable and only change the prompt text.
