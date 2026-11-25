---
title: Errors and exit codes
section: Reference
order: 2
description: The same stable codes in every interface, and the CLI exit code for each.
---

Every error carries a code that does not change between versions. The CLI turns it into an exit code; the SDKs put it on the error (`bridge.CodeOf(err)`, `e.code`); HTTP returns it in `{"error": {"code": "..."}}`.

| Code | Exit | Meaning | What to do |
|---|---|---|---|
| `invalid_input` | 2 | The request is malformed | Read the message; it names the field |
| `provider_not_found` | 10 | No provider with that id | `rbridge providers` lists them |
| `provider_unavailable` | 11 | Not installed, not running, or no daemon | `rbridge doctor` |
| `authentication_required` | 12 | The runtime is not signed in | Sign in with the runtime itself |
| `capability_unavailable` | 13 | No runtime can do what the task needs | Drop `--require`, or pick another runtime |
| `skill_not_found` | 20 | Unknown skill id | `rbridge skills list` |
| `skill_invalid` | 21 | The folder breaks the Agent Skills format | The message lists each problem |
| `skill_blocked` | 22 | Blocked, or not reviewed yet | `rbridge skills trust <id> reviewed` after reading it |
| `skill_unavailable` | 23 | Cannot be delivered to this runtime | See [delivery](/docs/skills/#delivery) |
| `skill_digest_mismatch` | 24 | Files changed since they were added, or do not match a lock or catalog | Add the skill again and review it |
| `permission_denied` | 30 | A limit was reached, such as sessions per client | Close a session |
| `policy_unenforceable` | 31 | The task wants a control rbridge cannot enforce here, such as a sandbox | Install an engine, or change the task |
| `approval_timeout` | 32 | Nobody answered an approval | Raise `policy.approval_timeout` or answer faster |
| `execution_timeout` | 40 | The turn ran past its timeout | `--timeout` |
| `execution_failed` | 41 | The runtime failed | The message carries its error |
| `cancelled` | 42 | Cancelled by the caller | |
| `session_not_found` | 50 | Unknown or closed session | `rbridge sessions` |
| `provider_protocol_error` | 60 | The runtime broke the protocol | Update the runtime; report it if it persists |
| `internal_error` | 70 | A bug in rbridge | Please [report it](https://github.com/runtime-bridge/rbridge/issues) |
