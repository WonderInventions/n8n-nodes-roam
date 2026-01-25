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
npm run release         # Create and publish a release
```

For webhook testing locally, use ngrok: `ngrok http 5678`

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
