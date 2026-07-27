# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an n8n community node package that integrates [Roam](https://ro.am) (video conferencing and messaging platform) with n8n workflow automation. It provides two nodes:
- **Roam Node**: Action node for sending messages, creating meeting links, and reading meetings/transcripts
- **Roam Trigger Node**: Webhook-based trigger for chat, meeting, recording, and transcript events

## Commands

```bash
npm run build           # Compile TypeScript (outputs to dist/)
npm run build:watch     # Watch mode compilation
npm run dev             # Start n8n in development mode
npm run lint            # Run ESLint
npm run lint:fix        # Auto-fix linting issues
npm test                # Run the vitest suite (offline; no Roam credentials)
npm run test:watch      # vitest in watch mode
```

CI (`.github/workflows/ci.yml`) runs `npm ci`, `npm run lint`, `npm test`, and
`npm run build` on every PR and push to `master`.

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
├── version.ts            # Roam-Version / User-Agent pins
├── webhooks.ts           # Signature verification + envelope unwrapping
├── loadOptions.ts        # Shared group picker
├── interfaces.ts         # TypeScript type mappings
└── resources/
    ├── message/send.ts       # Send message
    └── meeting/
        ├── create.ts         # Create meeting link
        ├── list.ts           # List meetings
        ├── transcript.ts     # Get meeting transcript
        └── prompt.ts         # Prompt a meeting
test/
├── helpers/context.ts    # Fake n8n execution contexts
└── *.test.ts             # vitest suites
```

### Key Components

**Transport Layer** (`transport.ts`): All API calls go through `apiRequest()` which handles authentication, base URL construction, headers, and error conversion to `NodeApiError`.

**Version pin** (`version.ts`): `ROAM_API_VERSION` is sent as `Roam-Version` on every REST call and as `apiVersion` on every v1 `webhook.subscribe`. **Read its comment before bumping it.** It must stay below `2026-07-23`, which requires a subscribe-time URL verification handshake that n8n cannot complete — the webhook URL is not served until the workflow is active, which is after the subscribe hook runs.

**Webhook handling** (`webhooks.ts`): Standard Webhooks signature verification and v1 envelope unwrapping. The trigger declares `rawBody: true` so the exact signed bytes are available; never verify against a re-serialized body.

**Credential System** (`credentials/RoamApi.credentials.ts`): API Key authentication with configurable `baseUrl` (defaults to `https://api.ro.am`) and an optional `webhookSigningSecret`. Validates credentials via `/v1/token.info`.

**Type Safety** (`interfaces.ts`): Defines `RoamMap` type mapping resources to their available operations, enabling TypeScript autocomplete.

**Trigger Dual Mode** (`RoamTrigger.node.ts`): Webhook triggers support two execution paths:
- Webhook-triggered: verifies the signature, unwraps the envelope, emits the payload
- Manual execution: fetches latest items via API for testing

### API Endpoints Used

- `POST /v1/chat.post` - Send messages, plain/markdown/Block Kit (group selection from `/v1/group.list`)
- `POST /v1/meeting.link.create` - Create meeting links (uses Luxon for RFC3339 datetime conversion)
- `GET /v1/meeting.list`, `GET /v1/meeting.transcript`, `POST /v1/meeting.prompt` - Meeting resource
- `POST /v1/webhook.subscribe` (dot-named v1 events) / `POST /v0/webhook.subscribe` (colon-named legacy events)
- `POST /v1/webhook.unsubscribe` - Teardown for both. **Always POST**: the route is registered POST-only, and a DELETE 405s while leaving the subscription row behind.
- `GET /v1/recording.list`, `GET /v1/meeting.list`, `GET /v1/chat.history`, `GET /v0/transcript.list` - Manual trigger execution

`recording:saved` and `transcript:saved` are colon-named v0 events with no
dot-named equivalent in Roam's registry, and `/v1/webhook.subscribe` rejects
colon-named names, so those two keep a v0 subscribe. Everything else is v1.

### Adding a trigger event

1. Add an entry to `EVENT_MAP` in `RoamTrigger.node.ts` (dot-named ⇒ v1 routing is automatic).
2. Add the option to the `event` property, plus any filter properties gated on it.
3. Extend `buildEventFilter` if the event supports a server-side filter — and remember Roam rejects an **empty** filter object with a 400, so send no filter when unconstrained.
4. Add coverage in `test/trigger.test.ts`.

## Testing

`npm test` runs vitest against fake n8n execution contexts (`test/helpers/context.ts`)
that record the HTTP calls the node would make. Assert on route, method, body,
and query string — that is where the v0/v1 differences live. Tests live in
`test/` (not `nodes/`) so `n8n-node build` never ships them and `n8n-node lint`
never applies node-authoring rules to them; `eslint.config.mjs` additionally
ignores `test/` so the cloud-compatibility "no dependencies" rule does not fire
on `vitest` imports.

## Code Style

- Single quotes, trailing commas, semicolons (Prettier)
- TypeScript strict mode enabled
- `@typescript-eslint/no-explicit-any` is disabled
