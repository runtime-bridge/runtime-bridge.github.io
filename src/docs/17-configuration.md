---
title: Configuration
section: Reference
order: 1
description: Every setting, its default and what it does.
---

rbridge reads YAML from these layers, later ones winning; maps merge and lists are replaced:

1. built-in defaults (`rbridge config --defaults` prints them)
2. system: `/etc/rbridge/config.yaml`, macOS `/Library/Application Support/rbridge/config.yaml`, Windows `%ProgramData%\rbridge\config.yaml`
3. user: `~/.config/rbridge/config.yaml`, macOS `~/Library/Application Support/rbridge/config.yaml`, Windows `%AppData%\rbridge\config.yaml`
4. project: `.rbridge.yaml` in the workspace
5. task: values set by the caller

`rbridge config` prints the merged result and which files were loaded. Unknown keys are an error. The system file can list `locked` keys (dotted paths such as `policy.default_profile`) that lower layers cannot change. `RBRIDGE_HOME` puts configuration, data, cache and runtime files under one directory.

## providers

| Key | Default | Meaning |
|---|---|---|
| `order` | `[claude-code, opencode]` | Preference when a task names no provider; others follow alphabetically |
| `<id>.enabled` | `true` | Turn a provider off |
| `<id>.executable` | detected | Absolute path to pin one installation |
| `<id>.model` | runtime default | Model used when a task does not choose one |
| `<id>.url` | `OLLAMA_HOST`, then `http://127.0.0.1:11434` | Address of a model server such as `ollama`; must be on this machine |
| `<id>.args` | manifest | Replace the launch arguments (for example `--experimental-acp` for older Gemini CLI) |
| `<id>.allow_account_login` | `false` | Use an account login for providers that need an API key by default (Gemini CLI). Ignored for `claude-acp` |
| `custom` | `[]` | ACP agents: `id`, `display_name`, `launch.command`, `launch.args`, `launch.env_passthrough`, `version_args`, `skills_dir` (project folder the agent reads skills from, such as `.agents/skills`; enables per-session skills). A local model server instead takes `integration: model-server`, `url` (a loopback address) and `api` (`ollama` or `openai`) |

Built-in providers: `claude-code`, `opencode`, `codex` (codex-acp), `gemini-cli`, `claude-acp` (API key only).

### Several Claude Code accounts

Claude Code keeps each account in its own directory, chosen with `CLAUDE_CONFIG_DIR`. rbridge makes every account its own provider, so a task always runs on the account you chose and its session records which one:

- `claude-code` is always the default account, `~/.claude`. rbridge does not pass your shell's `CLAUDE_CONFIG_DIR` through, so the account never changes with the terminal you start rbridge from.
- `claude-code-<name>` is found automatically from wrapper scripts named `claude-<name>` on `PATH` (or in `~/.local/bin`) that set `CLAUDE_CONFIG_DIR`, and from `~/.claude-<name>` directories. An account with a wrapper is started through it, so whatever the wrapper sets up applies; otherwise rbridge runs `claude` with `CLAUDE_CONFIG_DIR` set.
- Discovery reads only the wrapper scripts, looking for the `CLAUDE_CONFIG_DIR=` line. It never opens files inside an account directory or files a wrapper sources.

| Key | Default | Meaning |
|---|---|---|
| `claude-code.discover_accounts` | `true` | Turn automatic discovery off |
| `claude-code.accounts` | `[]` | Declare accounts: `name`, `config_dir` (`~` allowed), optional `launcher` (absolute path to a wrapper) |
| `claude-code-<name>.enabled` | `true` | Hide one account |

`rbridge doctor` warns when your shell's `CLAUDE_CONFIG_DIR` points at an account other than the default, and names the provider to use.

## policy

| Key | Default | Meaning |
|---|---|---|
| `default_profile` | `standard` | `observe`, `standard`, `controlled` or `custom` |
| `approval_timeout` | `2m` | Unanswered approvals are denied after this |
| `env_allowlist` | PATH, HOME, locale and OS basics | Variables passed to runtimes, plus each provider's own list |
| `custom.rules` | ask for everything | Map of tool kind (`read`, `search`, `think`, `fetch`, `edit`, `delete`, `move`, `execute`, `switch_mode`, `other`) to `allow`, `deny` or `ask` |
| `custom.outside_read` | `ask` | Reads outside the workspace |
| `custom.client_fs_write` | `false` | Offer ACP agents rbridge's file write method |
| `custom.block_network` | `false` | Declare that the profile wants network blocked (enforced only with sandbox `full`) |
| `custom.sandbox` | `sandbox.mode` | Sandbox mode for the custom profile |
| `require_enforced` | `[]` | Refuse tasks whose profile wants one of these controls (for example `network`) that rbridge cannot enforce |

## skills

| Key | Default | Meaning |
|---|---|---|
| `project_dir` | `.agents/skills` | Project skill folder |
| `allow_unreviewed` | `false` | Deliver unreviewed skills (without their scripts) |
| `git_require_pinned_revision` | `true` | Git sources must be a full commit hash |
| `catalogs` | `[]` | Skill catalogs to search and install from: `name` and `url` (https, or http on localhost). Format: [the catalog format](https://github.com/runtime-bridge/rbridge/blob/main/specs/skill-catalog.md) |

## execution

| Key | Default | Meaning |
|---|---|---|
| `max_concurrent_sessions` | `2` | Per process (CLI, library or daemon) |
| `task_timeout` | `30m` | Per turn unless the task sets its own |
| `idle_timeout` | `5m` | End a turn that produces no event for this long |
| `slot_wait` | `30s` | How long a new session waits for a free slot before failing with `provider_unavailable` |
| `resource_ceiling_percent` | `0` (off) | How busy sessions may make the machine. Below 75% of it every slot is available; from there concurrency ramps down to one session at the ceiling. A lone session always starts. Linux only; elsewhere nothing is throttled |
| `memory_headroom_mb` | `2048` | Free memory below which memory use counts towards the ceiling |
| `command_timeout` | `10m` | Reserved for commands rbridge runs itself |
| `max_output_bytes` | 10 MiB | Output cap for commands rbridge runs itself |
| `kill_grace_period` | `10s` | Between asking a runtime to stop and killing its process tree |
| `detect_timeout` | `5s` | Version command timeout during detection |
| `detect_cache_ttl` | `10m` | How long detection results are reused; `0` turns the cache off |

## audit

| Key | Default | Meaning |
|---|---|---|
| `enabled` | `true` | One record per session in `<data dir>/audit/` |
| `level` | `metadata` | `events` also keeps each session's events in `<data dir>/events/`; `full` adds raw runtime messages |
| `retention` | `720h` | Monthly files older than this are deleted |

## daemon

| Key | Default | Meaning |
|---|---|---|
| `ipc.enabled` | `true` | Unix socket `bridge.sock` in the runtime directory |
| `http.enabled` | `false` | Local HTTP API |
| `http.host`, `http.port` | `127.0.0.1`, `7432` | Port `0` picks a free one |
| `http.allowed_origins` | `[]` | Browser origins allowed to call the API |
| `http.allow_non_loopback` | `false` | Required to listen on a non-loopback address |
| `event_buffer` | `2000` | Events kept per session for replay |
| `requests_per_second` | `20` | Per client, bursts of twice that |
| `session_idle_timeout` | `30m` | Close daemon sessions nobody uses |

## sandbox

| Key | Default | Meaning |
|---|---|---|
| `mode` | `off` | `files`: only the workspace, the session folder and the runtime's own folders are writable. `full`: the same with no network at all (cloud runtimes cannot reach their API). A task's `--sandbox` wins over this |
| `engine` | `auto` | `bwrap` (bubblewrap), `docker`, or `auto` to use the first that works. Linux only |
| `writable` | `[]` | More folders runtimes may change, absolute or starting with `~/` |

A task that asks for a sandbox fails with `policy_unenforceable` when no engine works; it never runs unsandboxed. Ubuntu blocks bubblewrap unless unprivileged user namespaces are allowed for it, in which case `auto` falls back to Docker. With Docker, the runtime runs in a container built from an empty image with the host's system folders and home mounted read-only, as your own user.

## resolution

| Key | Default | Meaning |
|---|---|---|
| `fallback` | `denied` | `allowed` lets a task move to another provider when its provider is unavailable, cannot be signed in, or fails to start. Bad input, skill and policy errors never cause a move |
| `allow_billing_class_change` | `false` | Let a fallback move to a provider with a different billing class (subscription, API key, local). Without it the move happens only between providers whose class rbridge knows and finds equal |

Without `--provider`, rbridge picks the first available provider in `providers.order` that meets the task's requirements; that is a choice, not a fallback. Every fallback is shown as a warning notice and recorded in the session (`fallback`) and the audit log.

## A complete example

```yaml title="~/.config/rbridge/config.yaml"
version: 1
providers:
  order: [claude-code, opencode]
  opencode:
    model: ollama/qwen3:8b
  custom:
    - id: my-agent
      launch: { command: /usr/local/bin/my-agent, args: [--acp] }
      skills_dir: .agents/skills
policy:
  default_profile: standard
  approval_timeout: 2m
skills:
  catalogs:
    - { name: team, url: https://skills.example.com/index.json }
sandbox:
  mode: off
daemon:
  http: { enabled: true, port: 7432 }
resolution:
  fallback: allowed
```
