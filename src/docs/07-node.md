---
title: Node.js SDK
section: Use it
order: 4
description: A dependency-free client for the rbridge daemon, with TypeScript types.
---

```sh
npm install github:runtime-bridge/rbridge-sdk-ts
```

Node.js 20 or later. The package ships `index.d.ts`, so editors and TypeScript get full types.

## The everyday API

```js title="app.mjs"
import { Rbridge } from "@rbridge/sdk";

const rb = new Rbridge({ runtime: "claude-code" });   // any id from rb.runtimes(); unset lets rbridge pick

console.log((await rb.run("Summarise this project")).text);

for await (const chunk of await rb.run("Explain app.js", { stream: true })) process.stdout.write(chunk);

const chat = rb.chat();                                // a conversation that remembers
await chat.send("What does app.js do?");
console.log((await chat.send("Now write tests for it")).text);

const [a, b] = await Promise.all([rb.run("Review a.js"), rb.run("Review b.js")]);  // or rb.runMany([...])

const r = await rb.run("List the TODOs", { schema: { type: "object", properties: { todos: { type: "array", items: { type: "string" } } } } });
console.log(r.data.todos);

await rb.close();
```

Nothing to set up first: `new Rbridge()` starts the daemon if it is not running, and the workspace is the current folder. Every option (`runtime`, `model`, `workspace`, `skills`, `profile`, `approve`, `sandbox`, `timeout`, `maxConcurrency`, `maxCostUsd`) can be a default on the constructor and overridden on any call. `skills` takes ids or folders of skills your program ships. `approve` decides permission requests: `false` denies (the default), `true` allows, `"read"` allows reads, or pass a function. A `Response` has `text`, `data`, `runtime`, `sessionId`, `usage` and `raw`; `rb.usage` totals every run.

## The lower-level client

`await rb.client()`, or `connect()`, is what `Rbridge` is built on: sessions you drive yourself, every event, approvals with options and questions from the runtime.

### Run a task

```js title="review.mjs"
import { connect } from "@rbridge/sdk";

const rb = await connect({ client: "review-bot" });
try {
  const res = await rb.run(
    { workspace: "/home/me/src/app", prompt: "Review the last commit", profile: "observe" },
    { onEvent: (e) => e.type === "message.delta" && process.stdout.write(e.data.text) },
  );
  console.log("\n---", res.provider, res.usage);
} finally {
  rb.close();
}
```

`connect()` starts a daemon when none is running, using the bundled rbridge (or `RBRIDGE_BIN`, or rbridge on `PATH`); a daemon started this way stops by itself after 30 idle minutes. Pass `start: false` to only connect to one already running. Tasks can be a plain prompt (`rb.run("Summarise README.md")`), and the workspace defaults to the current folder. `connect()` finds the daemon's socket the same way rbridge does (`RBRIDGE_HOME`, XDG, OS defaults). `connectHTTP()` uses the local HTTP API and reads the URL and token from the daemon's runtime folder; turn it on with `daemon.http.enabled: true`.

## Calls

| Call | What it does |
|---|---|
| `run(task, options)` | Open a session, run one turn, close it |
| `open(task, options)` / `resume(id, options)` | A `Session` with `prompt()`, `cancel()`, `close()`, `modes()`, `setMode()`, `options()`, `setOption()` |
| `providers()`, `skills()`, `sessions()`, `status()` | Read the daemon's state |
| `addSkill(dir)`, `setSkillTrust(id, trust)` | Add a skill your app ships and mark it reviewed |
| `searchSkills(query)`, `addCatalogSkill(ref)` | Use configured skill catalogs |

Options: `onEvent`, `approver`, `onInput`, `model`, `mode`.

## Approvals

```js
const allowed = [/^npm test$/, /^npm run lint$/];

await rb.run(task, {
  approver: (req) => {
    if (req.kind === "read" || req.kind === "search") return true;
    if (req.kind === "execute" && allowed.some((r) => r.test(req.title.replace(/^run /, "")))) {
      return { allow: true, remember: true };
    }
    return false;
  },
});
```

Return `true`, `false`, or `{ allow, optionId, remember }`. Requests nobody answers are denied after `policy.approval_timeout`.

## Questions from the runtime

Some ACP agents ask the user for input, as a form or a page to open. Without `onInput` they are declined.

```js
await rb.run(task, {
  onInput: async (req) => {
    if (req.mode === "url") return { action: "decline" }; // rbridge never opens URLs itself
    return { action: "accept", content: { environment: "staging" } };
  },
});
```

## A conversation

```js
const s = await rb.open({ workspace: "/home/me/src/app", provider: "opencode" }, { mode: "code" });
console.log(await s.modes());                 // { current: "code", modes: [...] }
await s.setOption("model", "large");
await s.prompt("Add input validation to the signup form");
await s.prompt("Now write tests for it");
await s.close();
```

## Errors

Errors are `RbridgeError` with a stable `code`:

```js
import { RbridgeError } from "@rbridge/sdk";

try {
  await rb.run({ workspace: "/tmp/x", prompt: "hi", provider: "codex" });
} catch (e) {
  if (e instanceof RbridgeError && e.code === "provider_unavailable") console.error("Codex is not installed");
  else throw e;
}
```
