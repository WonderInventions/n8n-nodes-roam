import { version } from '../../package.json';

/**
 * Roam developer-API version this node is built and tested against.
 *
 * Sent as `Roam-Version` on every REST call and pinned explicitly as
 * `apiVersion` on every /v1 `webhook.subscribe` body, so the response and
 * delivery contracts follow this release rather than whenever the user's API key
 * happened to be created.
 *
 * `2026-07-07` is the common v1 webhook envelope
 * (`{ type, eventId, timestamp, apiVersion, data }`) — see
 * `unwrapWebhookEnvelope` in webhooks.ts. At this label the server's transform
 * registry carries only webhook-surface transforms, so REST response shapes are
 * identical to the `2026-06-01` baseline.
 *
 * Deliberately NOT `2026-07-23`: from that label Roam requires a subscribe-time
 * URL verification handshake — it POSTs a signed `webhook.verification` envelope
 * and only persists the subscription once the endpoint echoes the challenge.
 * n8n's webhook URL is not reachable until the workflow is active, and the
 * `create` hook runs before n8n starts serving it, so the handshake cannot
 * complete. Bump only in lockstep with the parsing code here — and only once
 * this node can answer a verification challenge.
 */
export const ROAM_API_VERSION = '2026-07-07';

/**
 * Advertised to the Roam appserver on every request for attribution in logs and
 * Datadog (@plugin.name:n8n-nodes-roam / @plugin.version). Version is read from
 * package.json so a release only bumps it in one place.
 */
export const ROAM_USER_AGENT = `n8n-nodes-roam/${version}`;
