---
title: Sandbox
section: Concepts
order: 4
description: Run the runtime where it can only write to your project, or reach nothing at all. Linux only.
---

By default rbridge does not sandbox the runtime: it controls what goes through it, and the runtime's own tools are trusted to ask. A sandbox makes the limits hold even when they do not.

| Mode | Writable | Network |
|---|---|---|
| `off` | everything the user can write | yes |
| `files` | the workspace, the session folder, the runtime's own state folders | yes |
| `full` | the same as `files` | none, not even the host's loopback |

```sh
rbridge run --sandbox files "Refactor the parser"
rbridge run --provider opencode --model ollama/qwen3:8b --sandbox full "Review this code"
```

Or set it for every task, or for the custom profile:

```yaml
sandbox:
  mode: files          # off, files or full
  engine: auto         # auto, bwrap or docker
  writable: [~/.npm]   # more folders runtimes may change
```

:::warn Full means full
With `full`, cloud runtimes such as Claude Code cannot reach their own API. It suits runtimes on a local model.
:::

## Engines

rbridge tries **bubblewrap** first and **Docker** second, and probes each one before use: an installed tool can still be blocked by the system (Ubuntu restricts the user namespaces bubblewrap needs). With Docker the runtime runs as your own user in a container built from an empty image, with the host's system folders and your home mounted read only. `rbridge doctor` says which engine works.

Commands rbridge runs for an ACP agent run inside the same sandbox.

## Guarantees and limits

- A task that asks for a sandbox **fails** with `policy_unenforceable` when no engine works. It never runs unsandboxed instead.
- The session notice, session record and audit log name the engine and mode, such as `docker:full`.
- Reads are not limited: a runtime needs its own sign-in files. Use a VM for work that must not see your files.
- Linux only. macOS and Windows report the sandbox as unavailable.
