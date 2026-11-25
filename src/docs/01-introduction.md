---
title: What is rbridge?
section: Start here
order: 1
description: One local interface to the agent runtimes already installed on your machine.
---

Developers already have agent runtimes installed and signed in: Claude Code, OpenCode, Codex, Gemini CLI. rbridge lets any program on the same machine hand work to them through one interface, with the same events, approvals and Agent Skills whichever runtime does the work.

rbridge does not run its own agent loop and never touches provider credentials. It starts the runtime you installed, talks to it over a documented protocol (the Agent Client Protocol, or a runtime's own headless mode), and stands between it and the software that gives it tasks.

## How it fits together

```text
 your app, script or agent
          |
   CLI / Go / Node.js / Python / HTTP / MCP
          |
       rbridge  ----  skills, policy, sandbox, audit
          |
 Claude Code  OpenCode  Codex  Gemini CLI  Ollama  any ACP agent
```

1. **Find.** rbridge detects the runtimes and accounts on the machine, without opening credential files.
2. **Equip.** Your app names the skills a task needs; rbridge checks their digests and delivers them to the runtime for that session only.
3. **Guard.** A policy profile answers permission requests it can decide, asks your code about the rest, and records every decision.
4. **Deliver.** Events stream while the runtime works. The result comes back as text, or as JSON matching a schema you give.

## Ways to use it

| Interface | When to use it |
|---|---|
| [CLI](/docs/cli/) | Scripts, CI jobs, trying things out, or chatting with a runtime (`rbridge chat`) |
| [Go library](/docs/go/) | Go programs, in-process, no daemon |
| [Node.js SDK](/docs/node/) and [Python SDK](/docs/python/) | Applications in those languages: `Rbridge(runtime="claude-code").run("...")`, with streaming, conversations and several runs at once as options |
| [HTTP API](/docs/http-api/) | Any language, a browser extension, a local web app |
| [MCP server](/docs/mcp/) | Letting another agent delegate work to your runtimes |

## What it is not

- **Not an agent.** The reasoning happens in the runtime you already use.
- **Not a credential manager.** Each runtime signs in its own way; rbridge only reports whether that looks like a subscription, an API key or a local model.
- **Not a sandbox by default.** It can add one on Linux ([Sandbox](/docs/sandbox/)), and every session states what is and is not enforced.

:::tip Where next
[Install rbridge](/docs/install/), then follow the [quickstart](/docs/quickstart/). Prefer reading code? Jump to the [examples](/docs/examples/).
:::
