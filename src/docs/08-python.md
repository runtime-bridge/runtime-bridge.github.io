---
title: Python SDK
section: Use it
order: 5
description: A standard-library-only client for the rbridge daemon.
---

```sh
pip install git+https://github.com/runtime-bridge/rbridge-sdk-python
rbridge daemon start
```

Python 3.10 or later, no third-party packages.

## Run a task

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

## Calls

| Call | What it does |
|---|---|
| `run(task, on_event=, approver=, model=, mode=, on_input=)` | Open, one turn, close |
| `open(task, ...)` / `resume(id, ...)` | A `Session` with `prompt()`, `cancel()`, `close()`, `modes()`, `set_mode()`, `options()`, `set_option()`; usable with `with` |
| `providers()`, `skills()`, `sessions()`, `status()` | Read the daemon's state |
| `add_skill(path)`, `set_skill_trust(id, trust)` | Add a skill your app ships and mark it reviewed |
| `search_skills(query)`, `add_catalog_skill(ref)` | Use configured skill catalogs |

## Approvals

```py
SAFE = {"pytest", "ruff check ."}

def approve(req):
    if req["kind"] in ("read", "search"):
        return True
    if req["kind"] == "execute" and req["title"].removeprefix("run ") in SAFE:
        return {"allow": True, "remember": True}
    return False

rb.run(task, approver=approve)
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
res = rb.run({"workspace": repo, "prompt": "Review for security issues", "profile": "observe", "output_schema": schema})
for f in (res.get("structured") or {}).get("findings", []):
    print(f["severity"], f["file"], f["title"])
```

## A conversation

```py
with rb.open({"workspace": repo, "provider": "opencode"}, mode="code") as s:
    print(s.modes())
    s.set_option("model", "large")
    s.prompt("Refactor the config loader")
    s.prompt("Run the tests and fix what breaks")
```

## Errors

```py
try:
    rb.run({"workspace": repo, "prompt": "hi", "skills": ["unknown"]})
except rbridge.RbridgeError as e:
    print(e.code)  # skill_not_found
```
