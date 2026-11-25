---
title: CLI
section: Use it
order: 1
description: Every command, with the examples you will actually type.
---

Every command accepts `--json`, and exit codes are stable (see [Errors and exit codes](/docs/errors/)).

## Set up

```sh
rbridge init                                         # folders and a commented starter configuration
rbridge init --config ./rbridge.yaml                 # install your own file, checked first
rbridge init --config ./rbridge.yaml --force         # replace a different one (backup kept)
rbridge init --skills ./skills --trust reviewed      # add a folder of skills in the same step
```

`init` is safe to run again: an existing configuration is kept unless you pass `--force`.

## Runtimes

```sh
rbridge providers                  # what is installed, versions, sign-in mode
rbridge providers --refresh        # detect again instead of using the cache
rbridge providers show opencode    # capabilities, skill folders, limits
rbridge providers accept claude-code   # accept a runtime binary that changed
rbridge doctor                     # check everything and suggest fixes
rbridge config                     # the merged configuration and its files
```

## Run a task

```sh
rbridge run "Summarise this project"
rbridge run --workspace ~/src/app --provider opencode --model ollama/qwen3:8b "List the TODO comments"
echo "Explain main.go" | rbridge run --quiet
rbridge run --json "Find dead code" | jq 'select(.type=="tool.started")'
```

| Flag | Meaning |
|---|---|
| `--workspace DIR` | Project the runtime works in (default: current directory) |
| `--provider ID` | Runtime to use; default is the first available one that meets the requirements |
| `--model NAME` | Model passed to the runtime |
| `--skill ID` | Skill to deliver; repeat for more |
| `--require CAP` | Capability the runtime must have, such as `structured_output`; repeatable |
| `--profile NAME` | `observe`, `standard`, `controlled` or `custom` |
| `--approve MODE` | `ask` (default on a terminal), `allow` or `deny` (default otherwise) |
| `--sandbox MODE` | `off`, `files` or `full` ([Sandbox](/docs/sandbox/)) |
| `--mode ID` | Runtime session mode, for runtimes that offer modes |
| `--schema FILE` | JSON schema; the answer comes back as matching JSON |
| `--timeout 10m` | Per turn |
| `--json`, `--quiet` | Events and result as JSON lines; or only the final answer |

### Structured output

```sh
cat > findings.json <<'JSON'
{"type":"object","required":["findings"],"properties":{"findings":{"type":"array","items":{"type":"string"}}}}
JSON
rbridge run --schema findings.json --quiet "List security problems in this project"
```

## Talk in a session

```sh
rbridge chat --provider claude-code
```

Inside a chat, `/modes`, `/mode <id>`, `/options`, `/set <option> <value>` and `/exit` control the session. Sessions are stored; pick them up later:

```sh
rbridge sessions                    # newest first
rbridge sessions show ses_1a2b3c
rbridge sessions resume ses_1a2b3c "Now add tests"
rbridge sessions cancel ses_1a2b3c
rbridge sessions prune --older-than 720h
```

## Skills

```sh
rbridge skills add ./skills/security-audit
rbridge skills add ./skills                # every skill found under ./skills
rbridge skills add ./skills --exclude 'draft-*' --dry-run
rbridge skills add ./skills --only security-audit,release-notes --trust reviewed
rbridge skills add https://github.com/org/skills --rev 4f1c0e7d9a2b3c4d5e6f708192a3b4c5d6e7f809 --subdir security-audit
rbridge skills list
rbridge skills show security-audit         # metadata, files, measured compatibility
rbridge skills trust security-audit reviewed
rbridge skills trust 'audit-*' release-notes reviewed
rbridge skills verify                      # recompute every digest
rbridge skills remove security-audit
```

Place a skill in a runtime's own folder for use outside rbridge, import a project's lock file, or install from a catalog:

```sh
rbridge skills deliver security-audit --provider claude-code --permanent
rbridge skills deliver security-audit --provider opencode --permanent --project .
rbridge skills deliveries
rbridge skills undeliver security-audit

rbridge skills import                      # reads ./skills-lock.json
rbridge skills search audit                # configured catalogs
rbridge skills add --catalog team:security-audit
rbridge skills digest ./my-skill           # the value a catalog lists
```

## Audit

```sh
rbridge audit                 # one line per session
rbridge audit --since 24h --json
```

## Daemon and MCP

```sh
rbridge daemon start          # background; also: stop, status, run (foreground)
rbridge mcp --profile observe # MCP server on stdio for other agents
```
