---
title: Runtimes and providers
section: Concepts
order: 1
description: How rbridge finds runtimes, chooses one for a task, and what each one supports.
---

A **provider** is one runtime rbridge can use: an executable it starts, or a local model server it calls. rbridge detects providers without opening credential files and caches the result for ten minutes (`rbridge providers --refresh` detects again).

## Built in

| Provider | How rbridge talks to it | Notes |
|---|---|---|
| `claude-code` | `claude -p` with stream-json | Your own login. Each account is its own provider: `claude-code-<name>` |
| `opencode` | ACP (`opencode acp`) | Cloud models, or local ones through Ollama |
| `codex` | ACP through `codex-acp` | ChatGPT login or `CODEX_API_KEY` |
| `gemini-cli` | ACP (`gemini --acp`) | API key by default; `allow_account_login` to opt in |
| `claude-acp` | ACP through `claude-agent-acp` | API key or a cloud provider only |
| `ollama` | HTTP, text only | Used only when a task names it |

`rbridge providers show <id>` lists a provider's capabilities with where each value came from (its handshake, its manifest, or a default), its skill folders and its limits.

## Your own agents

Any agent that speaks the Agent Client Protocol can be added without code:

```yaml title="config.yaml"
providers:
  custom:
    - id: my-agent
      launch:
        command: /usr/local/bin/my-agent
        args: [--acp]
      skills_dir: .agents/skills   # optional: enables per-session skills
```

## Local model servers

A model server is not an agent: it has no tools, cannot touch files and refuses skills. rbridge uses one only when a task names it, never in place of an agent.

```yaml title="config.yaml"
providers:
  ollama:
    model: qwen3:8b
  custom:
    - id: lmstudio
      integration: model-server
      url: http://127.0.0.1:1234
      api: openai
```

```sh
rbridge run --provider ollama "Write a haiku about bridges"
```

For agent work on a local model, use OpenCode configured with an Ollama model.

## Several Claude Code accounts

Every Claude Code account (each `CLAUDE_CONFIG_DIR`) becomes its own provider, found from wrapper scripts named `claude-<name>` and from `~/.claude-<name>` folders. `claude-code` is always `~/.claude`, whatever your shell sets.

```sh
rbridge run --provider claude-code-work "Triage the open issues"
```

## Choosing a model

Every runtime keeps its own models, and a task can pick one by name or by keyword, in the CLI (`--model`), the SDKs (`model=`) and HTTP (`"model"`):

| Name | Means |
|---|---|
| `latest` | The runtime's newest flagship. Claude Code: `opus`, its newest Opus |
| `auto` | The runtime's own recommended choice. Claude Code: `default`, which follows the account. With `providers.<id>.model` set, that model |
| A model name | Passed to the runtime. For ACP runtimes it is checked against the models they list; `big-pickle` finds `opencode/big-pickle`, and a typo gets the closest name |
| Your own names | `providers.<id>.models` maps names such as `fast` to a model, and can remap `latest` and `auto` |

ACP runtimes list no release dates, so `latest` keeps their default; `auto` picks a model they call auto when they have one. Model servers take their most recently pulled model for both. Every result says which model ran (`model`), and `rbridge providers show <id>` lists a runtime's names:

```yaml
providers:
  claude-code:
    models:
      fast: haiku
      latest: sonnet   # override the built-in mapping
```

## Choosing a runtime

With `--provider`, rbridge uses that runtime or fails. Without it, rbridge takes the first available provider in `providers.order` that has every required capability (`--require structured_output`).

### Fallback

When `resolution.fallback: allowed`, a task whose runtime is unavailable, cannot sign in or fails to start moves to the next suitable one, but only to a runtime with the **same billing class** (subscription, API key or local) unless `allow_billing_class_change` is set. Every move is a warning in the events and an entry in the audit log.

```yaml
resolution:
  fallback: allowed
  allow_billing_class_change: false
```

### Changed binaries

rbridge remembers each runtime's executable. If its path or contents change without an upgrade, the provider is flagged until you run `rbridge providers accept <id>`.
