# n8n-nodes-roam

This is an n8n community node. It lets you use Roam in your n8n workflows.

Roam is a video conferencing and messaging platform that enables teams to connect, collaborate, and communicate effectively through video meetings, messaging, and integrations.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

[Installation](#installation)  
[Operations](#operations)  
[Credentials](#credentials)  
[Compatibility](#compatibility)  
[Usage](#usage)  
[Resources](#resources)  
[Version history](#version-history)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

## Operations

### Roam Node

**Message**
- **Send Message**: Post plain text, markdown, or [Block Kit](https://developer.ro.am/docs/guides/block-kit) messages to a Roam group

**Meeting**
- **Create Meeting Link**: Create a new video meeting link
- **List Meetings**: List recorded meetings, optionally with their summary, action items, and chapters
- **Get Transcript**: Fetch the transcript cues for a meeting
- **Prompt Meeting**: Ask a question about a meeting transcript using AI

### Roam Trigger Node

- **New Chat Message**: A message was posted in Roam — filterable to direct messages, group chats, or only messages that mention your app
- **Meeting Ended**: A recorded meeting ended and its content is ready — optionally only meetings with a video recording
- **New Recording**: A meeting recording was saved
- **New Transcript**: A transcript was saved

## Credentials

To use this node, you need a Roam API key.

1. Go to your Roam developer account at [developer.ro.am](https://developer.ro.am)
2. Create an API Key application
3. Enable permissions corresponding to what you want it to do:
   - Actions
     - Send chat message: `chat:send_message`, `group:read`
     - Create meeting link: `meetinglink:write`
     - List meetings / Get transcript / Prompt meeting: `meetings:read`
   - Webhooks: `webhook:write`
     - New Chat Message: `chat:history`
     - Meeting Ended: `meetings:read`
     - New Recording: `recordings:read`
     - New Transcript: `transcript:read`
4. In n8n, create a new credential of type "Roam API Key"
5. Fill in your secret key
6. Fill in the **Webhook Signing Secret** (see below) if you use the Roam Trigger

### Webhook signature verification

Roam signs every webhook delivery with
[Standard Webhooks](https://www.standardwebhooks.com) headers (`webhook-id`,
`webhook-timestamp`, `webhook-signature`). Without verification, your n8n webhook
URL is an unauthenticated ingest endpoint: anyone who learns it can POST a
fabricated Roam event into your workflow.

Copy the signing secret shown alongside your API key in Roam Administration >
Developer into the credential's **Webhook Signing Secret** field. The Roam
Trigger then rejects any delivery whose signature does not verify (401, workflow
not started) and any delivery more than five minutes old or in the future.

The field is optional so existing workflows keep running after an upgrade, but an
empty value means no verification at all. Fill it in.

## Roam API version

The node pins `Roam-Version` (and the `apiVersion` on every v1
`webhook.subscribe`) in `nodes/Roam/version.ts`. It must stay **below**
`2026-07-23`: from that label Roam requires a subscribe-time URL verification
handshake, POSTing a signed `webhook.verification` challenge that the endpoint
must echo before the subscription is stored. n8n does not serve a workflow's
webhook URL until the workflow is active, which is after the subscribe hook runs,
so the handshake cannot complete.

## Migrating from 0.1.x

- The **Transcript** resource was removed. Its operations moved to the
  **Meeting** resource and now take a *meeting* ID rather than a v0 transcript
  ID. Get meeting IDs from **List Meetings** or the **Meeting Ended** trigger.
  Workflows still set to the old resource fail with that message rather than
  silently producing nothing.
- **Get Transcript** returns `{ id, cues: [{ speakerId, text, start, end }] }`.
  Summary and action items now come from **List Meetings** with the
  corresponding *Include* options rather than from the transcript response.
- Send Message posts through `/v1/chat.post`. Its response shape is
  `{ chatId, timestamp }` rather than the v0 tagged `chat` field.

## Compatibility

- n8n version: 1.0.0+
- Node.js version: 18.0.0+
- Tested with n8n versions: 1.0.x, 1.1.x

## Usage

### Basic Setup
1. Install the community node
2. Set up your Roam API credential (API key + webhook signing secret)
3. Use the Roam node to send messages, create meeting links, or read meetings
4. Use the Roam Trigger node to respond to webhook events

### Example Workflows
1. **Trigger**: Roam - New Chat Message (only when mentioned) → **Action**: Roam - Send Message (reply in the same group)
2. **Trigger**: Roam - Meeting Ended → **Action**: Roam - Prompt Meeting ("List the action items") → **Action**: your CRM
3. **Trigger**: HTTP Request (when a form is submitted) → **Action**: Roam - Create Meeting Link

## Development

To run n8n locally: 

- Run `ngrok http 5678` to support incoming webhooks. Set `WEBHOOK_URL` to the ngrok URL.
- Run `npm run dev`

### Tests

```bash
npm test           # vitest, offline — no Roam credentials needed
npm run test:watch
```

Tests run against fake n8n execution contexts (`test/helpers/context.ts`) and
assert on the HTTP calls the node *would* make: route, method, body, query. That
is where the v0/v1 differences live, so a regression to a v0 route or a dropped
`apiVersion` pin fails the build. CI runs lint, tests, and build on every PR.

## Resources

* [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
* [Roam API Documentation](https://developer.ro.am/)
* [Roam Developer Portal](https://developer.ro.am)

## Version history

See [CHANGELOG.md](./CHANGELOG.md) for the full history.

### 0.2.0
- v1-native: every call targets Roam's `/v1` surface
- **Breaking**: Transcript resource folded into Meeting; operations take meeting IDs
- **Breaking**: Send Message posts to `/v1/chat.post`
- Standard Webhooks signature verification on the trigger
- New trigger events: New Chat Message, Meeting Ended
- First automated test suite

### 0.1.1
- Initial release
- Roam node with meeting and messaging operations
- Roam Trigger node for webhook events
- Basic transport layer for API communication
- API key authentication
