---
title: Install
section: Start here
order: 2
description: One binary, no runtime of its own. Install it, then let it find yours.
---

rbridge is a single static binary for Linux, macOS and Windows on amd64 and arm64. It needs at least one agent runtime installed and signed in, such as Claude Code or OpenCode.

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

## Check the setup

`rbridge doctor` reports the configuration it loaded, its directories, every runtime it found with its version and sign-in mode, and whether a sandbox engine is available. Each problem comes with a fix.

```sh
rbridge doctor
```

## SDKs

The SDKs talk to the rbridge daemon. Neither has third-party dependencies.

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
