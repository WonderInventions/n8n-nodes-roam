# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an n8n community node package that integrates [Roam](https://ro.am) (video conferencing and messaging platform) with n8n workflow automation. It provides two nodes:
- **Roam Node**: Action node for sending messages and creating meeting links
- **Roam Trigger Node**: Webhook-based trigger for meeting and chat events

## Commands

```bash
npm run build           # Compile TypeScript (outputs to dist/)
npm run build:watch     # Watch mode compilation
npm run dev             # Start n8n in development mode
npm run lint            # Run ESLint
npm run lint:fix        # Auto-fix linting issues
npm test                # Unit tests (v2 contracts + v1 endpoint lock)
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
├── Roam.node.ts            # VersionedNodeType wrapper (defaultVersion 2)
├── RoamTrigger.node.ts     # VersionedNodeType wrapper (defaultVersion 2)
├── transport.ts            # Shared HTTP + error mapping (Roam-Version defaults to 2026-06-01)
├── v1/                     # Published 0.1.14 behavior (typeVersion 1)
│   ├── RoamV1.node.ts
│   ├── RoamTriggerV1.node.ts
│   └── resources/          # sendMessage + v0 meeting/transcript/webhooks
└── v2/                     # API v1 (typeVersion 2)
    ├── RoamV2.node.ts
    ├── RoamTriggerV2.node.ts
    ├── transport.ts        # Pins Roam-Version 2026-08-07
    └── resources/          # chat.post + meeting.*
```

### Key Components

**Transport Layer** (`transport.ts`): All API calls go through `apiRequest()` which handles authentication, base URL construction, headers, and error conversion to `NodeApiError`. `Roam-Version` defaults to `2026-06-01` (typeVersion 1). typeVersion 2 calls go through `v2/transport.ts`, which pins `2026-08-07`.

**Credential System** (`credentials/RoamApi.credentials.ts`): API Key authentication with configurable `baseUrl` (defaults to `https://api.ro.am`). Validates credentials via `/v1/token.info`.

**Type Safety** (`v1/interfaces.ts`, `v2/interfaces.ts`): Per-version `RoamMap` types mapping resources to their available operations.

**Node versioning**: Saved workflows keep `typeVersion: 1` and continue to run the 0.1.14 implementation. Newly added nodes use typeVersion 2 (API v1).

**Trigger Dual Mode** (`v2/RoamTriggerV2.node.ts`): Webhook triggers support two execution paths:
- Webhook-triggered: Unwraps the v1 `{type, eventId, timestamp, apiVersion, data}` envelope
- Manual execution: Fetches latest items via API for testing

### API Endpoints Used (typeVersion 2)

- `POST /v1/chat.post` - Send messages (group / chat / user destination; groups from `/v1/group.list`)
- `POST /v1/meeting.link.create` - Create meeting links (uses Luxon for RFC3339 datetime conversion)
- `GET /v1/meeting.list`, `GET /v1/meeting.info`, `GET /v1/meeting.transcript`, `POST /v1/meeting.prompt`
- `POST /v1/webhook.subscribe` / `unsubscribe` - Webhook lifecycle (dot-named v1 events only)
- `GET /v1/meeting.list`, `GET /v1/chat.list` - Manual trigger execution

typeVersion 1 still uses `POST /v1/chat.sendMessage` (text), `POST /v0/chat.post` (Block Kit), `POST /v0/meetinglink.create`, `POST /v0/webhook.subscribe` / `unsubscribe`, and v0 transcript endpoints.

## Code Style

- Single quotes, trailing commas, semicolons (Prettier)
- TypeScript strict mode enabled
- `@typescript-eslint/no-explicit-any` is disabled
