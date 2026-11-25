---
title: Policy, approvals and audit
section: Concepts
order: 3
description: Profiles decide what a runtime may do, your code answers the rest, and every session leaves a record.
---

## Profiles

| Profile | Reads | Edits in the workspace | Commands, fetches, deletes |
|---|---|---|---|
| `observe` | allowed | denied | denied |
| `standard` (default) | allowed | allowed | asked |
| `controlled` | allowed | asked | asked |
| `custom` | from `policy.custom.rules` | | |

Writes outside the workspace are always denied, and delivered skills are read only. With `observe`, Claude Code also has its write, shell and web tools removed.

```yaml title="A custom profile"
policy:
  default_profile: custom
  custom:
    rules: { read: allow, search: allow, edit: ask, execute: ask, fetch: deny, delete: deny }
    outside_read: deny
    sandbox: files
```

## Approvals

A request the profile leaves open goes to the caller: the terminal prompt in the CLI, your approver in code, or an `approval.required` event over HTTP. Nobody answering within `policy.approval_timeout` means no. An answer can **remember** the decision for the same tool and kind for the rest of the session; it never overrides a denial by policy.

Agents that speak ACP get files and terminals served by rbridge itself, so every file write and every command they make through rbridge is checked against the profile, time limited and confined to the workspace.

## What is enforced

Each session starts with a notice:

```text
profile standard: enforced by rbridge: environment, process lifetime, skill scripts,
client terminals; relies on the runtime asking: file writes, commands; not enforced: network
```

- **Enforced** controls hold whatever the runtime does.
- **Relies on the runtime asking** means the runtime's own tools are trusted to ask permission first.
- **Not enforced** is said out loud. Add a [sandbox](/docs/sandbox/) to enforce writes and network, or refuse such tasks with `policy.require_enforced: [network]`.

## Audit

One record per session in `<data dir>/audit/`, kept for `audit.retention`:

```sh
$ rbridge audit --since 24h
TIME              SESSION                   PROVIDER     PROFILE   TURNS  STOP      APPROVALS            NOT ENFORCED
2026-11-25 14:02  ses_59ad722aa26bccacdb2c  claude-code  standard  2      end_turn  3 allowed, 1 denied  -
```

`rbridge audit --json` prints the full records, including skills, fallbacks and the sandbox.

Records hold the runtime, profile, skills with digests, approvals, fallbacks, the sandbox and a digest of the result. Never prompts, code or tool input. Secrets that look like tokens or keys are masked in everything rbridge stores.
