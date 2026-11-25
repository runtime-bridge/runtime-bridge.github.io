---
title: Examples
section: Use it
order: 8
description: Three small programs that hand real work to the runtime you already have. Each ships its own skill, and all three were run against Claude Code.
---

The code lives in [`examples/`](https://github.com/runtime-bridge/rbridge/tree/main/examples) in the main repository. Each has a smoke test that runs it against rbridge's fake agent in CI.

## Release notes from Go

A Go backend that writes release notes without containing an agent. It embeds a `release-notes` skill in the binary, reads the Git history (subjects and bodies), runs the task read-only on whichever runtime is installed, and writes the file itself.

```sh
go run ./examples/go-release-notes -repo ~/src/app -version v1.4.0
go run ./examples/go-release-notes -repo ~/src/app -since v1.3.0 -provider claude-code -model haiku -v
```

The heart of it:

```go
//go:embed skills
var skills embed.FS

// ... copy the embedded skill to a temp dir, then:
b.AddSkill(ctx, dir, false)
b.SetSkillTrust(ctx, "release-notes", bridge.TrustReviewed) // the program ships it

res, err := b.Run(ctx, bridge.Task{
	Workspace: repo,
	Prompt:    bridge.Text("Write release notes for these commits:\n\n" + strings.Join(commits, "\n\n")),
	Skills:    []string{"release-notes"},
	Profile:   "observe", // the runtime reads; the program writes
})
os.WriteFile("RELEASE_NOTES.md", []byte("## "+version+"\n\n"+res.Output), 0o644)
```

## Security review from Python

A security tool that brings its knowledge as a skill (instructions plus a checklist) and lets the user's runtime do the reasoning. Findings come back as JSON matching a schema, become a Markdown report, and the exit code can gate CI. `sample/app.py` has deliberate flaws to try it on.

```sh
python3 examples/python-security-review/review.py                       # reviews sample/
python3 examples/python-security-review/review.py ~/src/app --fail-on critical
```

```py
from rbridge import Rbridge

rb = Rbridge(app="security-review")
result = rb.run(
    "Review this project for security vulnerabilities.",
    workspace=project,
    skills=[os.path.join(HERE, "skills", "vuln-review")],  # shipped with the tool, trusted on first use
    profile="observe",                                     # read-only
    schema=SCHEMA,
)
findings = result.data["findings"]
```

Against Claude Code it found the SQL injection, command injection, path traversal, hard-coded token and MD5 passwords, each with its line and a fix, and exited with 2.

## Operations check from Node.js

An operations tool that packages a diagnostics procedure and a health script as a skill, and lets the runtime run the check under the application's own rules: the `controlled` profile asks about every command, and the approver allows only the skill's script and a few read-only commands, each on its own.

```sh
cd examples/ts-ops-check && npm install
node check.js                                   # checks sample/services.json
node check.js ~/ops --runtime claude-code --sandbox files
```

```js
export function approve(req) {
  if (req.kind === "read" || req.kind === "search") return true;
  if (req.kind !== "execute") return false;
  const command = req.input?.command ?? req.title.replace(/^run /, "");
  return /^(?:(?:sh|bash) )?(?:\S*\/)?scripts\/health\.sh(?: \S*services\.json)?$/.test(command)
    || ["uptime", "df -h", "free -m"].includes(command);
}

const rb = new Rbridge({ app: "ops-check" });
const res = await rb.run("Check the health of the services in services.json and of this machine.", {
  workspace: dir,
  skills: [path.join(here, "skills", "ops-diagnostics")], // shipped with the tool, trusted on first use
  profile: "controlled",                                  // every command asks
  schema,
  approve,                                                // the rules above decide
});
console.log(res.data.status);
```

With one service up and one down, Claude Code reported `degraded`, the machine's load, disk and memory, and a next step for the service that was down, without changing anything.
