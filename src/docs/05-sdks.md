---
title: SDKs at a glance
section: Use it
order: 2
description: The same operations side by side in Go, Node.js, Python and plain HTTP. Pick a tab once and every example on the site follows.
---

| | Go | Node.js | Python | HTTP |
|---|---|---|---|---|
| Package | `github.com/runtime-bridge/rbridge/pkg/bridge` | `@rbridge/sdk` | `rbridge` | `http://127.0.0.1:7432/v1` |
| Entry point | `bridge.New`, or `bridge.Connect` for the daemon | `new Rbridge()` | `Rbridge()`, `AsyncRbridge()` | Any HTTP client |
| Runs | In your process, or through the daemon | Through the daemon | Through the daemon | Daemon with `daemon.http.enabled: true` |
| Dependencies | Two small Go modules | None | Standard library only | None |

The Node.js and Python SDKs start the daemon when it is not running (it then stops after 30 idle minutes), and the workspace defaults to the current folder, so there is nothing to set up before the first call. For HTTP, or a daemon that stays up, run `rbridge daemon start`. Go embeds rbridge with `bridge.New`, or talks to the daemon with `bridge.Connect`; both return the same `bridge.Client`.

In Node.js and Python every option (`runtime`, `model`, `workspace`, `skills`, `profile`, `approve`, `sandbox`, `timeout`, `stream`, `chat`, `max_cost_usd`) can be set once when you create `Rbridge` and overridden on any call. The [Node.js](/docs/node/) and [Python](/docs/python/) pages also cover the lower-level clients underneath, for sessions and events you drive yourself.

## Start

:::tabs
```go title="Go"
b, err := bridge.New(ctx, bridge.Options{})                            // in process
r, err := bridge.Connect(ctx, bridge.ConnectOptions{Client: "my-app"}) // through the daemon
```
```js title="Node.js"
import { Rbridge } from "@rbridge/sdk";

const rb = new Rbridge({ runtime: "claude-code" }); // any id from await rb.runtimes(); unset lets rbridge pick
```
```py title="Python"
from rbridge import Rbridge

rb = Rbridge(runtime="claude-code")  # any id from rb.runtimes(); unset lets rbridge pick
```
```sh title="HTTP"
TOKEN=$(cat $XDG_RUNTIME_DIR/rbridge/daemon.token)
curl -s http://127.0.0.1:7432/v1/status -H "Authorization: Bearer $TOKEN" -H "X-Rbridge-Client: my-app"
```
:::

Each client names itself (`app=` in the SDKs) and sees only its own sessions.

## Run one task

:::tabs
```go title="Go"
res, err := b.Run(ctx, bridge.Task{
	Workspace: "/home/me/src/app",
	Prompt:    bridge.Text("Summarise this project"),
	Provider:  "claude-code", // optional
})
fmt.Println(res.Output, res.Provider, res.Usage)
```
```js title="Node.js"
const res = await rb.run("Summarise this project");
console.log(res.text, res.runtime, res.usage);
```
```py title="Python"
res = rb.run("Summarise this project")
print(res.text, res.runtime, res.usage)
```
```sh title="HTTP"
curl -s http://127.0.0.1:7432/v1/run -H "Authorization: Bearer $TOKEN" -H "X-Rbridge-Client: my-app" \
  -d '{"task": {"workspace": "/home/me/src/app", "prompt": "Summarise this project", "provider": "claude-code"}}'
```
:::

## Stream the answer

In the SDKs, streaming is one option: the answer is printed as it is written and the call still returns all of it. Pass a function instead of `true` to receive the chunks, or use `rb.stream(...)` for an iterator.

:::tabs
```go title="Go"
res, err := b.Run(ctx, task, bridge.OnEvent(func(e bridge.Event) {
	if e.Type == bridge.EventMessageDelta {
		var d bridge.TextData
		json.Unmarshal(e.Data, &d)
		fmt.Print(d.Text)
	}
}))
```
```js title="Node.js"
await rb.run("Explain the build", { stream: true });

await rb.run("Explain the build", { stream: (chunk) => socket.send(chunk) }); // chunks to your own code
```
```py title="Python"
rb.run("Explain the build", stream=True)

rb.run("Explain the build", stream=websocket.send)  # chunks to your own code
```
```sh title="HTTP"
# Server-sent events with replay: reconnect with Last-Event-ID or ?after=<seq>.
curl -N http://127.0.0.1:7432/v1/sessions/$SESSION/events -H "Authorization: Bearer $TOKEN" -H "X-Rbridge-Client: my-app"
```
:::

Every event (tools, plans, usage) is available too: `on_event=` / `onEvent` on a call, or `stream.events` on the iterator.

## Approve or deny

The policy profile decides what it can. Requests it leaves to the caller are denied unless you say otherwise.

:::tabs
```go title="Go"
approver := bridge.WithApprover(func(_ context.Context, r bridge.ApprovalRequest) bridge.ApprovalDecision {
	if r.Kind == "read" || r.Kind == "search" {
		return r.AllowOnce("my-app")
	}
	d := r.RejectOnce("my-app")
	d.Reason = "this app only reads"
	return d
})
res, err := b.Run(ctx, task, approver)
```
```js title="Node.js"
const rb = new Rbridge({ approve: "read" }); // false (default) denies, true allows, "read" allows reads

await rb.run("Tidy the imports", { approve: (req) => req.kind !== "execute" }); // or decide each one
```
```py title="Python"
rb = Rbridge(approve="read")  # False (default) denies, True allows, "read" allows reads

rb.run("Tidy the imports", approve=lambda req: req["kind"] != "execute")  # or decide each one
```
```sh title="HTTP"
# Watch the event stream for approval.required, then answer it:
curl -s -X POST http://127.0.0.1:7432/v1/sessions/$SESSION/approvals/$APPROVAL \
  -H "Authorization: Bearer $TOKEN" -H "X-Rbridge-Client: my-app" -d '{"allow": true}'
```
:::

## Conversations

With `chat` set once, every run continues the same conversation, and several messages can go in one call. `rb.reset()` starts a new one; `rb.chat()` gives separate conversation objects when you want more than one at a time.

:::tabs
```go title="Go"
s, err := b.Open(ctx, bridge.Task{Workspace: "/home/me/src/app"})
defer s.Close(ctx)
s.Prompt(ctx, bridge.Text("Read the README"))
res, err := s.Prompt(ctx, bridge.Text("Now list its install steps"))
```
```js title="Node.js"
const bot = new Rbridge({ runtime: "claude-code", chat: true, stream: true });

await bot.run("Read the README");
await bot.run("Now list its install steps");
await bot.run(["Which step is slowest?", "How could it be faster?"]);
```
```py title="Python"
bot = Rbridge(runtime="claude-code", chat=True, stream=True)

bot.run("Read the README")
bot.run("Now list its install steps")
bot.run(["Which step is slowest?", "How could it be faster?"])
```
```sh title="HTTP"
SESSION=$(curl -s http://127.0.0.1:7432/v1/sessions -H "Authorization: Bearer $TOKEN" -H "X-Rbridge-Client: my-app" \
  -d '{"task": {"workspace": "/home/me/src/app"}}' | jq -r .id)
curl -s http://127.0.0.1:7432/v1/sessions/$SESSION/turns -H "Authorization: Bearer $TOKEN" -H "X-Rbridge-Client: my-app" \
  -d '{"prompt": "Read the README"}'
curl -s -X DELETE http://127.0.0.1:7432/v1/sessions/$SESSION -H "Authorization: Bearer $TOKEN" -H "X-Rbridge-Client: my-app"
```
:::

The CLI has the same: `rbridge chat --provider claude-code`.

## Several at once

The SDKs run a list of prompts side by side and return the answers in order. rbridge still applies its own limits on sessions and machine load.

:::tabs
```go title="Go"
results := make([]bridge.Result, len(prompts))
var g errgroup.Group
for i, p := range prompts {
	g.Go(func() (err error) {
		results[i], err = b.Run(ctx, bridge.Task{Workspace: repo, Prompt: bridge.Text(p)})
		return err
	})
}
err := g.Wait()
```
```js title="Node.js"
const answers = await rb.runMany(["Review a.js", "Review b.js", "Review c.js"]);

const [a, b] = await Promise.all([rb.run("Review a.js"), rb.run("Review b.js")]); // or your own way
```
```py title="Python"
answers = rb.run_many(["Review a.py", "Review b.py", "Review c.py"])

a, b = await asyncio.gather(arb.run("Review a.py"), arb.run("Review b.py"))  # with AsyncRbridge
```
```sh title="CLI"
for f in a.py b.py c.py; do rbridge run --quiet "Review $f" & done; wait
```
:::

`max_cost_usd` / `maxCostUsd` stops starting new runs once that much has been spent; `rb.usage` holds the running total.

## Ship your own skill

In the SDKs a skill folder your program ships can be named by its path: it is added and trusted on first use.

:::tabs
```go title="Go"
rec, err := b.AddSkill(ctx, "/opt/my-app/skills/release-notes", false)
_, err = b.SetSkillTrust(ctx, rec.ID, bridge.TrustReviewed) // your app wrote it
res, err := b.Run(ctx, bridge.Task{Workspace: repo, Prompt: bridge.Text("Write the notes"), Skills: []string{rec.ID}})
```
```js title="Node.js"
await rb.run("Write the notes", { skills: ["./skills/release-notes"] });
```
```py title="Python"
rb.run("Write the notes", skills=["./skills/release-notes"])
```
```sh title="HTTP"
curl -s http://127.0.0.1:7432/v1/skills -H "Authorization: Bearer $TOKEN" -H "X-Rbridge-Client: my-app" \
  -d '{"path": "/opt/my-app/skills/release-notes"}'
curl -s -X PUT http://127.0.0.1:7432/v1/skills/release-notes/trust -H "Authorization: Bearer $TOKEN" -H "X-Rbridge-Client: my-app" \
  -d '{"trust": "reviewed"}'
```
:::

A folder that holds several skills goes in with one call, with the same filters as the CLI (`only`, `exclude`, `trust`, a dry run):

:::tabs
```go title="Go"
res, err := b.AddSkills(ctx, []string{"/opt/my-app/skills"}, bridge.AddSkillsOptions{Exclude: []string{"draft-*"}, Trust: bridge.TrustReviewed})
```
```js title="Node.js"
const ids = await rb.addSkills("./skills", { exclude: ["draft-*"] }); // trusted as reviewed by default
```
```py title="Python"
ids = rb.add_skills("./skills", exclude=["draft-*"])  # trusted as reviewed by default
```
```sh title="HTTP"
curl -s http://127.0.0.1:7432/v1/skills/batch -H "Authorization: Bearer $TOKEN" -H "X-Rbridge-Client: my-app" \
  -d '{"paths": ["/opt/my-app/skills"], "exclude": ["draft-*"], "trust": "reviewed"}'
```
:::

## Structured answers

:::tabs
```go title="Go"
schema := json.RawMessage(`{"type":"object","required":["risk"],"properties":{"risk":{"enum":["low","medium","high"]}}}`)
res, err := b.Run(ctx, bridge.Task{Workspace: repo, Prompt: bridge.Text("Rate the upgrade risk"), OutputSchema: schema},
	bridge.WithProfile("observe"))
fmt.Println(string(res.Structured))
```
```js title="Node.js"
const res = await rb.run("Rate the upgrade risk", {
  profile: "observe",
  schema: { type: "object", required: ["risk"], properties: { risk: { enum: ["low", "medium", "high"] } } },
});
console.log(res.data.risk);
```
```py title="Python"
res = rb.run("Rate the upgrade risk", profile="observe",
             schema={"type": "object", "required": ["risk"], "properties": {"risk": {"enum": ["low", "medium", "high"]}}})
print(res.data["risk"])
```
```sh title="CLI"
rbridge run --profile observe --schema risk.json --quiet "Rate the upgrade risk"
```
:::

## Errors

Every interface reports the same stable codes, such as `provider_unavailable` or `skill_blocked` ([full list](/docs/errors/)).

:::tabs
```go title="Go"
if bridge.CodeOf(err) == bridge.ErrAuthenticationRequired {
	fmt.Println("sign in to the runtime first")
}
```
```js title="Node.js"
try {
  await rb.run("Summarise this project");
} catch (e) {
  if (e.code === "authentication_required") console.log("sign in to the runtime first");
}
```
```py title="Python"
try:
    rb.run("Summarise this project")
except rbridge.RbridgeError as e:
    if e.code == "authentication_required":
        print("sign in to the runtime first")
```
:::
