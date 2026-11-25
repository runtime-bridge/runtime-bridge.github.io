---
title: Install
section: Start here
order: 2
description: One binary, no runtime of its own. Install it, then let it find yours.
---

rbridge is a single static binary for Linux, macOS and Windows on amd64 and arm64. It needs at least one agent runtime installed and signed in, such as Claude Code or OpenCode.

There are two ways to have it, and they can live side by side:

| | Global | Per project |
|---|---|---|
| How | The install script, Go, or a source build | `pip install rbridge` in a virtual environment, or `npm install @rbridge/sdk` in a project |
| The program | On your `PATH`, one copy for the machine | Inside `.venv` or `node_modules`, used only there (`rbridge` in the environment, `npx rbridge`) |
| Its data | Your user folders (configuration, skills, sessions, audit) | The project's `.rbridge` folder |
| Removing it | `rbridge uninstall --yes`, plus `--purge` for the data | `pip uninstall rbridge` or `npm uninstall @rbridge/sdk`, or delete the environment; delete `.rbridge` for the data |

Inside a project with its own copy, that copy is used and never the global one. `RBRIDGE_HOME`, when set, always decides where the data goes.

:::note Per-project packages are not published yet
The wheels and npm packages that carry rbridge are built by each SDK's release scripts and will be on PyPI and npm with the first release. Until then, install rbridge globally and the SDKs from Git, as below.
:::

## Install script

The script downloads the latest release, checks its SHA-256 checksum (and its cosign signature when cosign is installed) and puts `rbridge` in `~/.local/bin`.

```sh
curl -fsSL https://raw.githubusercontent.com/runtime-bridge/rbridge/main/scripts/install.sh | sh
```

## With Go

Go 1.25 or later:

```sh
go install github.com/runtime-bridge/rbridge/cmd/rbridge@latest
```

## From source

```sh
git clone https://github.com/runtime-bridge/rbridge
cd rbridge
make build
./bin/rbridge version
```

## Uninstall

`rbridge uninstall` lists the program and each data folder with its size, and changes nothing. Add `--yes` to remove the program, and `--purge` to remove the data as well:

```sh
rbridge uninstall
rbridge uninstall --yes
rbridge uninstall --purge --yes
```

For a copy that came with an SDK, it names the pip or npm command instead, since that package manager owns the file.

## Check the setup

`rbridge doctor` reports the configuration it loaded, its directories, every runtime it found with its version and sign-in mode, and whether a sandbox engine is available. Each problem comes with a fix.

```sh
rbridge doctor
```

## SDKs

The SDKs talk to the rbridge daemon and start it themselves when it is not running (a daemon started that way stops after 30 idle minutes). Neither has third-party dependencies. Once installed, the first call is one line:

```python
from rbridge import Rbridge
print(Rbridge(runtime="claude-code").run("Summarise this project").text)
```

:::tabs
```sh title="Node.js"
npm install github:runtime-bridge/rbridge-sdk-ts
```
```sh title="Python"
pip install git+https://github.com/runtime-bridge/rbridge-sdk-python
```
```sh title="Go"
go get github.com/runtime-bridge/rbridge/pkg/bridge
```
:::

:::note Runtimes are yours
rbridge never installs, bundles or signs in to a runtime. Install them the usual way (for example `npm install -g @anthropic-ai/claude-code`) and sign in once. rbridge finds them on `PATH` and in their usual folders.
:::
