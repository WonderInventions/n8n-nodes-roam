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
- **Send Message**: Send messages to a group, existing chat, or user DM
- **Create Meeting Link**: Create new video meeting links
- **List / Get Meeting**: List meetings or fetch one by ID
- **Get Transcript**: Fetch transcript cues for a meeting
- **Prompt Meeting**: Ask a question about a meeting transcript

### Roam Trigger Node
- **Meeting Ended / Started**: Trigger when a meeting starts or when its content is ready
- **New Recording / New Transcript**: Compatibility aliases for Meeting Ended (`hasVideo: true` for recordings)
- **Chat Message**: Trigger on new, edited, or deleted chat messages

## Credentials

To use this node, you need to authenticate with Roam's API using OAuth2.

1. Go to your Roam developer account at [developer.ro.am](https://developer.ro.am)
2. Create an API Key application
3. Enable permissions corresponding to what you want it to do:
  - Actions
    - Send chat message: `chat:send_message` or `chat:write`, plus `group:read` (group picker) and `user:read` (DM picker)
    - Create meeting link: `meetinglink:write`
    - List / get / prompt meetings: `meetings:read`
  - Webhooks: `webhook:write`
    - Meeting Ended / Started / New Recording / New Transcript: `meetings:read`
    - Chat Message: `chat:history` (plus `chat:read` for manual trigger tests)
4. In n8n, create a new credential of type "Roam API Key"
5. Fill in your secret key

## Compatibility

- n8n version: 1.0.0+
- Node.js version: 18.0.0+
- Tested with n8n versions: 1.0.x, 1.1.x

## Usage

### Basic Setup
1. Install the community node
2. Set up your Roam OAuth2 credentials
3. Use the Roam node to send messages or create meetings
4. Use the Roam Trigger node to respond to webhook events

### Example Workflow
1. **Trigger**: HTTP Request (when a form is submitted)
2. **Action**: Roam - Send Message (notify team about the submission)
3. **Action**: Roam - Create Meeting Link (schedule a follow-up meeting)

## Development

To run n8n locally: 

- Run `ngrok http 5678` to support incoming webhooks. Set `WEBHOOK_URL` to the ngrok URL.
- Run `npm run dev`

## Resources

* [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
* [Roam API Documentation](https://developer.ro.am/)
* [Roam Developer Portal](https://developer.ro.am)

## Version history

### 0.2.0
- Add node typeVersion 2 on the API v1 surface (`POST /v1/chat.post`, meeting.* endpoints, v1 webhooks)
- Existing workflows stay on typeVersion 1 (the 0.1.14 behavior) until you add a new Roam node or upgrade the node version in the editor
- typeVersion 2 Send Message destinations: group, chat ID, or user DM
- typeVersion 2 Meeting list / info / transcript / prompt replace the Transcript resource
- typeVersion 2 trigger events: Meeting Ended, Meeting Started, Chat Message

### 0.1.1
- Initial release
- Roam node with meeting and messaging operations
- Roam Trigger node for webhook events
- Basic transport layer for API communication
- OAuth2 authentication
