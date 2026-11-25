---
title: Skills
section: Concepts
order: 2
description: Agent Skills with digests and trust, delivered to each runtime for one session, from folders, Git, lock files or catalogs.
---

A skill is a folder with a `SKILL.md` (YAML front matter and instructions), plus optional `scripts/`, `references/` and `assets/`. rbridge uses the [Agent Skills](https://agentskills.io/specification) format unchanged.

```markdown title="skills/release-notes/SKILL.md"
---
name: release-notes
description: Turns commits into release notes for users of the project.
license: Apache-2.0
---

# Writing release notes
1. Group the changes into New, Changed and Fixed...
```

## The library

```sh
rbridge skills add ./skills/release-notes          # copied in, with a SHA-256 digest
rbridge skills add ./skills/drafts --link          # used in place
rbridge skills add https://github.com/org/skills --rev <full commit> --subdir release-notes
```

Every skill has a digest of its files. If the files change, rbridge refuses the skill until it is added again.

## Trust

| Trust | Instructions delivered | Scripts delivered |
|---|---|---|
| `unreviewed` | no (unless `skills.allow_unreviewed`) | no |
| `reviewed`, `trusted` | yes | yes; running them still goes through approvals |
| `restricted` | yes | no |
| `blocked` | no | no |

```sh
rbridge skills show release-notes     # read it first
rbridge skills trust release-notes reviewed
```

A new version starts unreviewed again.

## Delivery

A task names its skills and rbridge makes them visible to that runtime for that session only, without touching your project or your own skill folders:

| Runtime | How |
|---|---|
| Claude Code | A session folder passed with `--add-dir` |
| OpenCode | A session config file passed with `OPENCODE_CONFIG` |
| Gemini CLI, Codex, custom agents with `skills_dir` | A link in the project's `.agents/skills` for the session, hidden from Git and removed afterwards; refused if the project already has a skill of that name |

Each delivery is reported as a `skill.delivered` event and in the audit record.

### Permanent delivery

For runtimes you start by hand:

```sh
rbridge skills deliver release-notes --provider claude-code --permanent
rbridge skills deliver release-notes --provider opencode --permanent --project .
rbridge skills deliveries
rbridge skills undeliver release-notes
```

rbridge tracks what it placed, updates it when trust changes, removes it when the skill is blocked or removed, and never replaces a folder it did not create.

## Lock files

Projects using the `skills` installer keep a `skills-lock.json`. Import it:

```sh
rbridge skills import            # or --no-fetch to use only installed copies
```

Each entry is taken from the copy in `.agents/skills` or from its Git source at the locked commit, and installed only if its files match the lock's hash.

## Catalogs

A catalog is a JSON index of skills pinned to a Git commit and a digest. rbridge reads only catalogs you configure:

```yaml
skills:
  catalogs:
    - name: team
      url: https://skills.example.com/index.json
```

```sh
rbridge skills search audit
rbridge skills add --catalog team:security-audit   # refused unless the files match the digest
rbridge skills digest ./my-skill                   # for publishers
```

## Measured compatibility

`rbridge skills show <id>` reports, for each runtime the skill was used with, whether it **works** (the runtime was seen opening it in a completed turn), was only **delivered**, failed, or could not be delivered. Nothing is taken from the skill's own claims.
