---
title: HTTP API
section: Use it
order: 6
description: The daemon's local HTTP API, with server-sent events. Any language that can make a request can use it.
---

Turn it on in your configuration and start the daemon:

```yaml title="~/.config/rbridge/config.yaml"
daemon:
  http:
    enabled: true
    port: 7432
```

```sh
rbridge daemon start
TOKEN=$(cat $XDG_RUNTIME_DIR/rbridge/daemon.token)
```

Every request needs `Authorization: Bearer <token>` and `X-Rbridge-Client: <your app>`. The API listens on loopback only, refuses browser origins not listed in `daemon.http.allowed_origins`, and checks the `Host` header against DNS rebinding. Each client sees only its own sessions. The full contract is in [`specs/http-api.yaml`](https://github.com/runtime-bridge/rbridge/blob/main/specs/http-api.yaml).

```sh
alias rb='curl -s -H "Authorization: Bearer $TOKEN" -H "X-Rbridge-Client: my-app"'
```

## One-shot task

```sh
rb http://127.0.0.1:7432/v1/run -d '{"task": {"workspace": "/home/me/src/app", "prompt": "Summarise this project"}}'
```

## Session with live events

```sh
SESSION=$(rb http://127.0.0.1:7432/v1/sessions -d '{"task": {"workspace": "/home/me/src/app", "profile": "controlled"}}' | jq -r .id)

# In another terminal: follow events (reconnect with Last-Event-ID or ?after=<seq>)
rb -N http://127.0.0.1:7432/v1/sessions/$SESSION/events

# Start a turn without waiting; the outcome arrives as events
rb http://127.0.0.1:7432/v1/sessions/$SESSION/turns -d '{"prompt": "Fix the failing test", "wait": false}'

# Answer an approval.required event
rb -X POST http://127.0.0.1:7432/v1/sessions/$SESSION/approvals/$APPROVAL -d '{"allow": true, "remember": true}'

rb -X DELETE http://127.0.0.1:7432/v1/sessions/$SESSION
```

## Endpoints

| Method and path | Purpose |
|---|---|
| `GET /v1/health` | Liveness, no token needed |
| `GET /v1/status` | Version, pid, open sessions |
| `GET /v1/providers`, `GET /v1/providers/{id}` | Runtimes (`?refresh=true` detects again) |
| `GET /v1/skills`, `POST /v1/skills`, `GET /v1/skills/{id}`, `DELETE /v1/skills/{id}` | Skill library; POST takes `path`, a Git `url` + `rev` (+ `subdir`), or `catalog` |
| `PUT /v1/skills/{id}/trust` | `{"trust": "reviewed"}` |
| `GET /v1/skills/search?q=` | Configured catalogs |
| `POST /v1/sessions`, `GET /v1/sessions`, `GET /v1/sessions/{id}`, `DELETE /v1/sessions/{id}` | Sessions; POST takes `task`, `model`, `mode`, `input` |
| `POST /v1/sessions/{id}/turns` | `prompt`, optional `wait: false` |
| `POST /v1/sessions/{id}/cancel`, `POST /v1/sessions/{id}/resume` | Stop a turn; reopen a stored session |
| `GET /v1/sessions/{id}/events` | Server-sent events with replay |
| `GET /v1/sessions/{id}/approvals`, `POST /v1/sessions/{sid}/approvals/{aid}` | Pending approvals; answer with `allow` or `option_id`, and `remember` |
| `GET /v1/sessions/{id}/modes`, `PUT /v1/sessions/{id}/mode` | Runtime session modes |
| `GET /v1/sessions/{id}/options`, `PUT /v1/sessions/{id}/options/{option}` | Runtime settings such as the model |
| `GET /v1/sessions/{id}/inputs`, `POST /v1/sessions/{sid}/inputs/{iid}` | Questions from the runtime; answer with `action` and `content` |
| `POST /v1/run` | Open, one turn, close |
| `GET /v1/audit?since=` | Audit records |

Errors use HTTP status codes and a body `{"error": {"code": "...", "message": "..."}}` with the [stable codes](/docs/errors/).

## IPC

The same methods are available as JSON-RPC over the Unix socket `bridge.sock` in the runtime folder, which the SDKs use. See [`specs/ipc-protocol.md`](https://github.com/runtime-bridge/rbridge/blob/main/specs/ipc-protocol.md).
