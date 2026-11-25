---
title: SDKs at a glance
section: Use it
order: 2
description: The same operations side by side in Go, Node.js, Python and plain HTTP. Pick a tab once and every example on the site follows.
---

| | Go | Node.js | Python | HTTP |
|---|---|---|---|---|
| Package | `github.com/runtime-bridge/rbridge/pkg/bridge` | `@runtime-bridge/sdk` | `rbridge` | `http://127.0.0.1:7432/v1` |
| Runs | In your process, or through the daemon | Through the daemon | Through the daemon | Daemon with `daemon.http.enabled: true` |
| Dependencies | Two small Go modules | None | Standard library only | None |

The Node.js and Python SDKs, and HTTP, need the daemon: `rbridge daemon start`. Go can embed rbridge with `bridge.New`, or connect to the daemon with `bridge.Connect`; both return the same `bridge.Client` interface.

## Connect

:::tabs
```go title="Go"
b, err := bridge.New(ctx, bridge.Options{})                            // in process
r, err := bridge.Connect(ctx, bridge.ConnectOptions{Client: "my-app"}) // through the daemon
```
```js title="Node.js"
import { connect, connectHTTP } from "@runtime-bridge/sdk";

const rb = await connect({ client: "my-app" });       // Unix socket
const web = await connectHTTP({ client: "my-app" });  // local HTTP, reads the token itself
```
```py title="Python"
import rbridge

rb = rbridge.connect(client="my-app")          # Unix socket
web = rbridge.connect_http(client="my-app")    # local HTTP, reads the token itself
```
```sh title="HTTP"
TOKEN=$(cat $XDG_RUNTIME_DIR/rbridge/daemon.token)
curl -s http://127.0.0.1:7432/v1/status -H "Authorization: Bearer $TOKEN" -H "X-Rbridge-Client: my-app"
```
:::

Each client names itself and sees only its own sessions.

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
const res = await rb.run({ workspace: "/home/me/src/app", prompt: "Summarise this project", provider: "claude-code" });
console.log(res.output, res.provider, res.usage);
```
```py title="Python"
res = rb.run({"workspace": "/home/me/src/app", "prompt": "Summarise this project", "provider": "claude-code"})
print(res["output"], res["provider"], res.get("usage"))
```
```sh title="HTTP"
curl -s http://127.0.0.1:7432/v1/run -H "Authorization: Bearer $TOKEN" -H "X-Rbridge-Client: my-app" \
  -d '{"task": {"workspace": "/home/me/src/app", "prompt": "Summarise this project", "provider": "claude-code"}}'
```
:::

## Stream events

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
await rb.run(task, {
  onEvent: (e) => e.type === "message.delta" && process.stdout.write(e.data.text),
});
```
```py title="Python"
rb.run(task, on_event=lambda e: e["type"] == "message.delta" and print(e["data"]["text"], end=""))
```
```sh title="HTTP"
# Server-sent events with replay: reconnect with Last-Event-ID or ?after=<seq>.
curl -N http://127.0.0.1:7432/v1/sessions/$SESSION/events -H "Authorization: Bearer $TOKEN" -H "X-Rbridge-Client: my-app"
```
:::

## Approve or deny

The policy profile decides what it can. Requests it leaves to the caller reach your approver; without one they are denied.

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
await rb.run(task, {
  // true, false, or { allow, optionId, remember } where remember covers the rest of the session
  approver: (req) => req.kind === "read" || req.kind === "search",
});
```
```py title="Python"
rb.run(task, approver=lambda req: req["kind"] in ("read", "search"))
# or return {"allow": True, "remember": True} to allow the same kind for the rest of the session
```
```sh title="HTTP"
# Watch the event stream for approval.required, then answer it:
curl -s -X POST http://127.0.0.1:7432/v1/sessions/$SESSION/approvals/$APPROVAL \
  -H "Authorization: Bearer $TOKEN" -H "X-Rbridge-Client: my-app" -d '{"allow": true}'
```
:::

## Multi-turn sessions

:::tabs
```go title="Go"
s, err := b.Open(ctx, bridge.Task{Workspace: "/home/me/src/app"})
defer s.Close(ctx)
s.Prompt(ctx, bridge.Text("Read the README"))
res, err := s.Prompt(ctx, bridge.Text("Now list its install steps"))
```
```js title="Node.js"
const s = await rb.open({ workspace: "/home/me/src/app" });
await s.prompt("Read the README");
const res = await s.prompt("Now list its install steps");
await s.close();
```
```py title="Python"
with rb.open({"workspace": "/home/me/src/app"}) as s:
    s.prompt("Read the README")
    res = s.prompt("Now list its install steps")
```
```sh title="HTTP"
SESSION=$(curl -s http://127.0.0.1:7432/v1/sessions -H "Authorization: Bearer $TOKEN" -H "X-Rbridge-Client: my-app" \
  -d '{"task": {"workspace": "/home/me/src/app"}}' | jq -r .id)
curl -s http://127.0.0.1:7432/v1/sessions/$SESSION/turns -H "Authorization: Bearer $TOKEN" -H "X-Rbridge-Client: my-app" \
  -d '{"prompt": "Read the README"}'
curl -s -X DELETE http://127.0.0.1:7432/v1/sessions/$SESSION -H "Authorization: Bearer $TOKEN" -H "X-Rbridge-Client: my-app"
```
:::

## Ship your own skill

:::tabs
```go title="Go"
rec, err := b.AddSkill(ctx, "/opt/my-app/skills/release-notes", false)
_, err = b.SetSkillTrust(ctx, rec.ID, bridge.TrustReviewed) // your app wrote it
res, err := b.Run(ctx, bridge.Task{Workspace: repo, Prompt: bridge.Text("Write the notes"), Skills: []string{rec.ID}})
```
```js title="Node.js"
const { record } = await rb.addSkill("./skills/release-notes");
await rb.setSkillTrust(record.id, "reviewed");
await rb.run({ workspace: repo, prompt: "Write the notes", skills: [record.id] });
```
```py title="Python"
rec = rb.add_skill("./skills/release-notes")["record"]
rb.set_skill_trust(rec["id"], "reviewed")
rb.run({"workspace": repo, "prompt": "Write the notes", "skills": [rec["id"]]})
```
```sh title="HTTP"
curl -s http://127.0.0.1:7432/v1/skills -H "Authorization: Bearer $TOKEN" -H "X-Rbridge-Client: my-app" \
  -d '{"path": "/opt/my-app/skills/release-notes"}'
curl -s -X PUT http://127.0.0.1:7432/v1/skills/release-notes/trust -H "Authorization: Bearer $TOKEN" -H "X-Rbridge-Client: my-app" \
  -d '{"trust": "reviewed"}'
```
:::

An application that ships a folder of skills adds them in one call. Each takes the same filters as the CLI (`only`, `exclude`, `trust`, a dry run) and returns one item per skill found, with its status:

:::tabs
```go title="Go"
res, err := b.AddSkills(ctx, []string{"/opt/my-app/skills"}, bridge.AddSkillsOptions{Exclude: []string{"draft-*"}, Trust: bridge.TrustReviewed})
```
```js title="Node.js"
const { items } = await rb.addSkills("./skills", { exclude: ["draft-*"], trust: "reviewed" });
```
```py title="Python"
items = rb.add_skills("./skills", exclude=["draft-*"], trust="reviewed")["items"]
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
const res = await rb.run({
  workspace: repo,
  prompt: "Rate the upgrade risk",
  profile: "observe",
  output_schema: { type: "object", required: ["risk"], properties: { risk: { enum: ["low", "medium", "high"] } } },
});
console.log(res.structured);
```
```py title="Python"
res = rb.run({
    "workspace": repo,
    "prompt": "Rate the upgrade risk",
    "profile": "observe",
    "output_schema": {"type": "object", "required": ["risk"], "properties": {"risk": {"enum": ["low", "medium", "high"]}}},
})
print(res.get("structured"))
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
  await rb.run(task);
} catch (e) {
  if (e.code === "authentication_required") console.log("sign in to the runtime first");
}
```
```py title="Python"
try:
    rb.run(task)
except rbridge.RbridgeError as e:
    if e.code == "authentication_required":
        print("sign in to the runtime first")
```
:::
