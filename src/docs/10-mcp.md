---
title: MCP server
section: Use it
order: 7
description: Let another agent delegate work to the runtimes on your machine, through the Model Context Protocol.
---

`rbridge mcp` runs an MCP server on standard input and output. Any MCP client, including another coding agent, can then list your runtimes and skills and run tasks on them, under rbridge's policy.

```sh
rbridge mcp --profile observe
```

The profile applies to tasks that do not name one. Nobody answers approvals in this mode, so requests the profile leaves open are denied.

## Tools

| Tool | Arguments | Returns |
|---|---|---|
| `rbridge_providers` | none | One line per runtime with status and version |
| `rbridge_skills` | none | Installed skills with their trust state |
| `rbridge_run` | `workspace`, `prompt`, optional `provider`, `skills`, `profile`, `timeout_seconds` | The runtime's answer |

## Register it with a client

:::tabs
```json title="Claude Code (.mcp.json)"
{
  "mcpServers": {
    "rbridge": { "command": "rbridge", "args": ["mcp", "--profile", "observe"] }
  }
}
```
```json title="OpenCode (opencode.json)"
{
  "mcp": {
    "rbridge": { "type": "local", "command": ["rbridge", "mcp", "--profile", "observe"] }
  }
}
```
:::

:::tip A second opinion
With rbridge registered, one runtime can ask another for a review: "use rbridge_run with provider opencode to review this diff".
:::
