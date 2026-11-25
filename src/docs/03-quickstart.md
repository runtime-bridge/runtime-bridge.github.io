---
title: Quickstart
section: Start here
order: 3
description: From nothing to a task with a skill and an approval, in five minutes.
---

## 1. See what you have

`rbridge init` creates rbridge's folders and a starter configuration; it is safe to run again.

```sh
$ rbridge init
$ rbridge providers
PROVIDER     STATUS     VERSION  INTEGRATION      AUTH     PATH
claude-code  available  2.1.331  claude-headless  unknown  /home/me/.local/bin/claude
opencode     available  1.19.6   acp              unknown  /home/me/.local/bin/opencode
ollama       missing             model-server     local    http://127.0.0.1:11434
```

Each Claude Code account on the machine shows up as its own provider (`claude-code-work`, `claude-code-pro`).

## 2. Run a task

```sh
rbridge run --workspace ~/src/app "Summarise what this project does"
```

Without `--provider`, rbridge picks the first available runtime in your preference order. You see the work as it streams: messages, tool calls, plans.

## 3. Add a skill

A skill is a folder with a `SKILL.md`, in the [Agent Skills](https://agentskills.io/specification) format. New skills start **unreviewed** and are refused until you read and trust them.

```sh
rbridge skills add ./skills/security-audit
rbridge skills show security-audit
rbridge skills trust security-audit reviewed
rbridge run --skill security-audit "Audit this project"
```

## 4. Answer an approval

Under the default `standard` profile, edits in the workspace are allowed, while commands, fetches and deletes are asked about. On a terminal rbridge asks you:

```text
[approve] Bash wants to: npm test
          allow? [y]es / [n]o / [a]lways this session:
```

Choose a profile with `--profile observe` (read only), `standard` or `controlled` (asks before edits too).

## 5. Do the same from code

:::tabs
```go title="Go"
b, _ := bridge.New(ctx, bridge.Options{})
res, err := b.Run(ctx, bridge.Task{
	Workspace: "/home/me/src/app",
	Prompt:    bridge.Text("Audit this project"),
	Skills:    []string{"security-audit"},
}, bridge.WithApprover(func(_ context.Context, r bridge.ApprovalRequest) bridge.ApprovalDecision {
	return r.RejectOnce("my-app") // this app never lets the runtime change things
}))
```
```js title="Node.js"
import { connect } from "@rbridge/sdk";

const rb = await connect({ client: "my-app" });
const res = await rb.run(
  { workspace: "/home/me/src/app", prompt: "Audit this project", skills: ["security-audit"] },
  { approver: () => false },
);
```
```py title="Python"
import rbridge

with rbridge.connect(client="my-app") as rb:
    res = rb.run(
        {"workspace": "/home/me/src/app", "prompt": "Audit this project", "skills": ["security-audit"]},
        approver=lambda req: False,
    )
```
:::

The SDKs talk to the daemon. `connect()` starts one when none is running, and one started that way stops after 30 idle minutes; `rbridge daemon start` runs one that stays up.

## Next

- [CLI](/docs/cli/) for every command and flag
- [SDKs at a glance](/docs/sdks/) for the same task in each language
- [Skills](/docs/skills/) and [Policy](/docs/policy/) for the rules of the game
