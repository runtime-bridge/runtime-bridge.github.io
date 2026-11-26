---
title: Python SDK
section: Use it
order: 5
description: A standard-library-only client for the rbridge daemon.
---

```sh
pip install git+https://github.com/runtime-bridge/rbridge-sdk-python
```

Python 3.10 or later, no third-party packages.

## The everyday API

```py title="app.py"
from rbridge import Rbridge

rb = Rbridge(runtime="claude-code")               # any id from rb.runtimes(); unset lets rbridge pick

print(rb.run("Summarise this project").text)      # one answer

rb.run("Explain app.py", stream=True)             # printed as it is written

bot = Rbridge(runtime="claude-code", chat=True, stream=True)   # set it all once
bot.run("What does app.py do?")                   # one conversation, streamed
bot.run("Now write tests for it")                 # remembers the last answer
bot.run(["Summarise the tests", "Shorter"])       # several messages, one call

for r in rb.run_many(["Review a.py", "Review b.py"]):  # side by side, no threads to write
    print(r.text)

r = rb.run("List the TODOs", schema={"type": "object", "properties": {"todos": {"type": "array", "items": {"type": "string"}}}})
print(r.data["todos"])                            # structured output, parsed
```

Nothing to set up first: `Rbridge()` starts the daemon if it is not running, and the workspace is the current folder. Every option (`runtime`, `model`, `workspace`, `skills`, `profile`, `approve`, `sandbox`, `timeout`, `max_concurrency`, `max_cost_usd`) can be a default on `Rbridge(...)` and overridden on any call. `skills` takes ids or folders of skills your program ships. `stream=True` prints as the answer is written and still returns the whole `Response`; pass a function to receive the chunks, or use `rb.stream(...)` for an iterator. `chat=True` makes every `run` continue one conversation (`rb.reset()` starts a new one; `rb.chat()` gives separate conversation objects). `approve` decides permission requests: `False` denies (the default), `True` allows, `"read"` allows reads, or pass a function. A `Response` has `text`, `data`, `runtime`, `session_id`, `usage` and `raw`; `rb.usage` totals every run. `model` takes `"latest"` (the runtime's newest flagship), `"auto"` (its own recommended choice) or a model name, and the response's `model` says which one ran. When rbridge is full, runs queue instead of failing.

In async code, `AsyncRbridge` has the same calls awaited, so `asyncio.gather(rb.run("a"), rb.run("b"))` runs two at once and `await rb.run(..., stream=True)` streams.

## Approvals

Requests the policy profile leaves to your program are denied unless `approve` says otherwise: `True` allows them, `"read"` allows reads and searches, or a function decides each one.

```py
SAFE = {"pytest", "ruff check ."}

def approve(req):
    if req["kind"] in ("read", "search"):
        return True
    return req["kind"] == "execute" and req["title"].removeprefix("run ") in SAFE

rb = Rbridge(runtime="claude-code", profile="controlled", approve=approve)
rb.run("Run the tests and fix what breaks", stream=True)
```

## Structured output

```py
schema = {
    "type": "object",
    "required": ["findings"],
    "properties": {"findings": {"type": "array", "items": {
        "type": "object",
        "required": ["severity", "file", "title"],
        "properties": {"severity": {"enum": ["high", "medium", "low"]}, "file": {"type": "string"}, "title": {"type": "string"}},
    }}},
}
res = rb.run("Review for security issues", profile="observe", schema=schema)
for f in res.data["findings"]:
    print(f["severity"], f["file"], f["title"])
```

## Errors

```py
import rbridge

try:
    rb.run("hi", skills=["unknown"])
except rbridge.RbridgeError as e:
    print(e.code)  # skill_not_found
```

The codes are listed on the [errors page](/docs/errors/).

## The lower-level client

`rb.client`, or `rbridge.connect()`, is what `Rbridge` is built on: sessions you drive yourself, every event, approvals with options and questions from the runtime.

### Run a task

```py title="summary.py"
import rbridge

with rbridge.connect(client="summary") as rb:
    res = rb.run(
        {"workspace": "/home/me/src/app", "prompt": "Summarise this project", "profile": "observe"},
        on_event=lambda e: e["type"] == "message.delta" and print(e["data"]["text"], end="", flush=True),
    )
    print("\n---", res["provider"], res.get("usage"))
```

`on_event` runs on a background thread for every event. `rbridge.connect()` starts a daemon when none is running, using the bundled rbridge (or `RBRIDGE_BIN`, or rbridge on `PATH`); a daemon started this way stops by itself after 30 idle minutes. Pass `start=False` to only connect to one already running. Tasks can be a plain prompt (`rb.run("Summarise README.md")`), and the workspace defaults to the current folder. `rbridge.connect_http()` uses the local HTTP API instead of the socket.

### Calls

| Call | What it does |
|---|---|
| `run(task, on_event=, approver=, model=, mode=, on_input=)` | Open, one turn, close |
| `open(task, ...)` / `resume(id, ...)` | A `Session` with `prompt()`, `cancel()`, `close()`, `modes()`, `set_mode()`, `options()`, `set_option()`; usable with `with` |
| `providers()`, `skills()`, `sessions()`, `status()` | Read the daemon's state |
| `add_skill(path)`, `set_skill_trust(id, trust)` | Add a skill your app ships and mark it reviewed |
| `search_skills(query)`, `add_catalog_skill(ref)` | Use configured skill catalogs |

### Approvals remembered for a session

An approver on the lower-level client can return `{"allow": True, "remember": True}` to allow the same kind of request for the rest of the session:

```py
SAFE = {"pytest", "ruff check ."}

def approve(req):
    if req["kind"] in ("read", "search"):
        return True
    if req["kind"] == "execute" and req["title"].removeprefix("run ") in SAFE:
        return {"allow": True, "remember": True}
    return False

with rbridge.connect() as c:
    c.run({"workspace": repo, "prompt": "Run the tests and fix what breaks"}, approver=approve)
```

### Modes and settings

Runtimes that offer session modes and settings (ACP runtimes such as OpenCode) expose them on a session:

```py
with rb.client.open({"workspace": repo, "provider": "opencode"}, mode="code") as s:
    print(s.modes())
    s.set_option("model", "large")
    s.prompt("Refactor the config loader")
```
