# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an n8n community node package that integrates [Roam](https://ro.am) (video conferencing and messaging platform) with n8n workflow automation. It provides two nodes:
- **Roam Node**: Action node for sending messages and creating meeting links
- **Roam Trigger Node**: Webhook-based trigger for recording and transcript events

## Commands

```bash
npm run build           # Compile TypeScript (outputs to dist/)
npm run build:watch     # Watch mode compilation
npm run dev             # Start n8n in development mode
npm run lint            # Run ESLint
npm run lint:fix        # Auto-fix linting issues
```

For webhook testing locally, use ngrok: `ngrok http 5678`

## Releasing

Releases are published to npm by GitHub Actions with an **npm provenance**
attestation — required for n8n Cloud verified community nodes (effective
2026-05-01). Publishing happens **only in CI**, never from a local machine.

`master` is protected — changes land via a PR with CI (lint + build) green.
To cut a release:

1. Bump the version on a branch, push, and open a PR:
   `npm version <new-version> --no-git-tag-version`, commit, push, then merge
   the PR once CI passes.
2. Tag the merged commit on `master` and push the tag — this publishes:
   ```bash
   git checkout master && git pull
   git tag v<new-version> && git push origin v<new-version>
   ```

Pushing the `v*.*.*` tag triggers `.github/workflows/publish.yml`, which runs
`n8n-node release` in CI — it lints, builds, and runs `npm publish` with
provenance enabled.

- **Do not run `npm run release` locally.** The modern `@n8n/node-cli` (>=0.23)
  hard-requires the branch be named `main`; this repo releases from `master`,
  so the local command will fail. Use the tag-push flow above.
- **Auth is npm OIDC trusted publishing** (no `NPM_TOKEN` secret). The trusted
  publisher is configured on npmjs.com for repo `WonderInventions/n8n-nodes-roam`,
  workflow `publish.yml`. If the publish step ever 404s, that mapping is missing.
- `eslint` is pinned to exactly `9.29.0` (an exact peer dep of `@n8n/node-cli`);
  don't loosen it or installs will break.

## Architecture

### Resource-Operation Pattern

The codebase follows n8n's standard resource-operation pattern:

```
nodes/Roam/
├── Roam.node.ts          # Main action node definition
├── RoamTrigger.node.ts   # Webhook trigger node
├── transport.ts          # Centralized API request handler
├── interfaces.ts         # TypeScript type mappings
└── resources/
    ├── message/send.ts   # Send message operation
    └── meeting/create.ts # Create meeting link operation
```

### Key Components

**Transport Layer** (`transport.ts`): All API calls go through `apiRequest()` which handles authentication, base URL construction, headers, and error conversion to `NodeApiError`.

**Credential System** (`credentials/RoamApi.credentials.ts`): API Key authentication with configurable `baseUrl` (defaults to `https://api.ro.am`). Validates credentials via `/v0/token.info`.

**Type Safety** (`interfaces.ts`): Defines `RoamMap` type mapping resources to their available operations, enabling TypeScript autocomplete.

**Trigger Dual Mode** (`RoamTrigger.node.ts`): Webhook triggers support two execution paths:
- Webhook-triggered: Uses incoming webhook body directly
- Manual execution: Fetches latest items via API for testing

### API Endpoints Used

- `POST /v1/chat.sendMessage` - Send messages (requires group selection from `/v1/groups.list`)
- `POST /v0/meetinglink.create` - Create meeting links (uses Luxon for RFC3339 datetime conversion)
- `POST /v0/webhook.subscribe` / `unsubscribe` - Webhook lifecycle management
- `GET /v1/recording.list`, `GET /v0/transcript.list` - Manual trigger execution

## Code Style

- Single quotes, trailing commas, semicolons (Prettier)
- TypeScript strict mode enabled
- `@typescript-eslint/no-explicit-any` is disabled
