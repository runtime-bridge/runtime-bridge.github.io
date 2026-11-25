---
title: Sessions and events
section: Concepts
order: 5
description: A session is one conversation with one runtime. Everything that happens in it arrives as a normalised event.
---

## Sessions

A one-shot task is a session with one turn. A session has its own id (`ses_...`), stores the runtime's native id so it can be resumed, and moves through states: `created`, `starting`, `ready`, `running`, `closed`, or `failed` and `interrupted` when something goes wrong.

```sh
rbridge sessions                       # list
rbridge sessions resume ses_1a2b3c "Continue with the tests"
```

A conversation is a session with several turns. In the terminal that is `rbridge chat --provider claude-code`; in the SDKs, `chat=True` (`chat: true`) on `Rbridge` makes every run continue the same session, or `rb.chat()` gives a separate one; in Go, `b.Open` returns a session to `Prompt` again and again.

Sessions whose process ended unexpectedly show as `interrupted`. Old ones are pruned with `rbridge sessions prune` and, in the daemon, daily.

## Events

The same events arrive in every interface: CLI `--json`, Go `OnEvent`, SDK `onEvent` / `on_event`, and server-sent events over HTTP.

| Event | Data |
|---|---|
| `session.started` | Native id, model, sign-in mode |
| `skill.delivered` | Skill id, digest, delivery mode, whether scripts came along |
| `turn.started` | Turn id |
| `message.delta`, `thought.delta` | `text` |
| `plan.updated` | Plan entries with status |
| `tool.started`, `tool.updated` | Tool id, title, kind, status, input |
| `approval.required`, `approval.resolved` | The request; the decision and who made it |
| `input.required`, `input.resolved` | A question from the runtime; its answer |
| `mode.updated` | The runtime's new session mode |
| `usage.updated` | Tokens and cost, when the runtime reports them |
| `notice` | Enforcement report, fallbacks, warnings |
| `turn.completed` | Stop reason, output, structured output, usage |
| `turn.failed` | Error code and message |
| `session.closed` | |

```json title="One event"
{"seq": 14, "time": "2026-11-25T14:02:11Z", "session_id": "ses_1a2b3c", "turn_id": "ses_1a2b3c.1",
 "type": "tool.started", "provider": "claude-code",
 "data": {"id": "toolu_01", "title": "Read README.md", "kind": "read", "status": "pending"}}
```

## Modes and settings

ACP runtimes may offer session modes (such as `ask` and `code`) and settings (such as the model). rbridge exposes them in every interface:

:::tabs
```sh title="CLI"
rbridge run --provider opencode --mode code "Add a health endpoint"
# in rbridge chat: /modes, /mode code, /options, /set model large
```
```go title="Go"
s, _ := b.Open(ctx, task, bridge.WithMode("code"))
cur, modes, _ := s.Modes(ctx)
_ = s.SetOption(ctx, "model", "large")
```
```js title="Node.js"
const s = await rb.open(task, { mode: "code" });
await s.modes();
await s.setOption("model", "large");
```
```py title="Python"
with rb.open(task, mode="code") as s:
    s.modes()
    s.set_option("model", "large")
```
:::

Claude Code does not expose its modes through rbridge: its permission modes could bypass your policy. Use profiles instead.

## Questions from the runtime

Some agents ask the user something mid-task, as a form or a page to open. rbridge forwards the question to whoever supplied an input handler (`WithInput`, `onInput`, `on_input`, or `input: true` over HTTP) and declines it otherwise. It never opens a URL itself.
