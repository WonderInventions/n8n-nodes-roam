# n8n smoke test

Imports the workflow JSON in `workflows/` into a real n8n instance (the same
shape a user would save from the editor), points a `roamApi` credential at your
local appserver, and executes via webhook.

## Prerequisites

1. Local Roam API on `http://localhost:5587`
2. Built node: `npm run build`
3. An API key for that Roam

## Run against an already-open `npm run dev`

```bash
npm run dev   # in another terminal — loads this package into n8n

ROAM_API_KEY=rk_... \
N8N_EMAIL=you@example.com \
N8N_PASSWORD='your-n8n-password' \
npm run test:smoke
```

## Or spawn a throwaway n8n

First run downloads `n8n@latest` via npx.

```bash
ROAM_API_KEY=rk_... SMOKE_START_N8N=1 npm run test:smoke
```

## Environment

| Variable | Default | Purpose |
|---|---|---|
| `ROAM_API_KEY` | (required) | Bearer token for appserver |
| `ROAM_BASE_URL` | `http://localhost:5587` | Appserver origin |
| `N8N_URL` | `http://localhost:5678` | n8n origin |
| `N8N_EMAIL` / `N8N_PASSWORD` | `smoke@example.com` / `SmokeTest1!` | n8n owner login |
| `N8N_API_KEY` | | Use the public n8n API instead of cookie login |
| `SMOKE_START_N8N` | | `1` to spawn n8n if `N8N_URL` is down |
| `SMOKE_GROUP_ID` | first `/v1/group.list` row | Group to send into |
| `SMOKE_SKIP_V1` | | `1` to skip the typeVersion 1 send |
| `SMOKE_N8N_LOG` | | `1` to print spawned n8n logs |
| `SMOKE_N8N_EPHEMERAL` | | `1` to use a fresh n8n data dir (slow; re-runs migrations) |

The Meeting Ended trigger case is skipped when the key lacks `webhook:read` / `webhook:write`.

## What it exercises

| Workflow | Node | Hits |
|---|---|---|
| `v2-send-message.json` | Roam typeVersion 2 | `POST /v1/chat.post` |
| `v1-send-message.json` | Roam typeVersion 1 | `POST /v1/chat.sendMessage` |
| `v2-meeting-list.json` | Roam typeVersion 2 | `GET /v1/meeting.list` |
| `v2-trigger-meeting-ended.json` | Roam Trigger v2 | `POST /v1/webhook.subscribe` / `unsubscribe` |

Send cases post a real message into the chosen group, tagged `n8n-smoke <timestamp>`.
