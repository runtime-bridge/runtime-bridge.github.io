---
title: Node.js SDK
section: Use it
order: 4
description: A dependency-free client for the rbridge daemon, with TypeScript types.
---

```sh
npm install github:runtime-bridge/rbridge-sdk-ts
rbridge daemon start
```

Node.js 20 or later. The package ships `index.d.ts`, so editors and TypeScript get full types.

## Run a task

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

`connect()` finds the daemon's socket the same way rbridge does (`RBRIDGE_HOME`, XDG, OS defaults). `connectHTTP()` uses the local HTTP API and reads the URL and token from the daemon's runtime folder; turn it on with `daemon.http.enabled: true`.

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
