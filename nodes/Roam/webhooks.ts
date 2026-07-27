import { createHmac, timingSafeEqual } from 'node:crypto';
import type { IDataObject } from 'n8n-workflow';

/**
 * Inbound webhook handling: Standard Webhooks signature verification and v1
 * event-envelope unwrapping.
 *
 * Roam signs every delivery whose API client has a signing secret
 * (https://www.standardwebhooks.com):
 *
 *   webhook-id         the per-occurrence event ID (also the envelope `eventId`)
 *   webhook-timestamp  unix seconds
 *   webhook-signature  space-separated list of `v1,<base64 HMAC-SHA256>`
 *
 * The signed content is `${webhook-id}.${webhook-timestamp}.${rawBody}` and the
 * key is the base64-decoded signing secret (with any `whsec_` prefix stripped).
 *
 * Without this check an n8n webhook URL is an unauthenticated ingest endpoint:
 * anyone who learns it can POST a fabricated Roam event into the workflow.
 */

/** Reject deliveries outside this window, in seconds (replay protection). */
export const WEBHOOK_TIMESTAMP_TOLERANCE_S = 300;

export type SignatureFailure =
	| 'no_secret_configured'
	| 'no_raw_body'
	| 'missing_signature_headers'
	| 'invalid_timestamp'
	| 'timestamp_out_of_tolerance'
	| 'signature_mismatch';

export type VerificationResult = { ok: true } | { ok: false; reason: SignatureFailure };

type HeaderBag = Record<string, unknown> | undefined;

/**
 * Case-insensitive header lookup. n8n lowercases incoming header names, but the
 * raw request object and test fixtures may not, so never index directly.
 */
export function headerValue(headers: HeaderBag, name: string): string | undefined {
	if (!headers || typeof headers !== 'object') {
		return undefined;
	}
	const wanted = name.toLowerCase();
	for (const key of Object.keys(headers)) {
		if (key.toLowerCase() === wanted) {
			const value = (headers as Record<string, unknown>)[key];
			if (Array.isArray(value)) {
				return typeof value[0] === 'string' ? value[0] : undefined;
			}
			return typeof value === 'string' ? value : undefined;
		}
	}
	return undefined;
}

function decodeSecret(secret: string): Buffer {
	const payload = secret.startsWith('whsec_') ? secret.slice(6) : secret;
	return Buffer.from(payload, 'base64');
}

/**
 * Verify a Standard Webhooks signature over the raw request body.
 *
 * `rawBody` must be the bytes Roam signed. Re-serializing the parsed body would
 * change key order and whitespace and never match.
 */
export function verifyStandardWebhookSignature(
	secret: string,
	headers: HeaderBag,
	rawBody: string | undefined,
	nowSeconds?: number,
): VerificationResult {
	if (!secret) {
		return { ok: false, reason: 'no_secret_configured' };
	}
	if (typeof rawBody !== 'string') {
		return { ok: false, reason: 'no_raw_body' };
	}

	const msgId = headerValue(headers, 'webhook-id');
	const msgTimestamp = headerValue(headers, 'webhook-timestamp');
	const msgSignature = headerValue(headers, 'webhook-signature');

	if (!msgId || !msgTimestamp || !msgSignature) {
		return { ok: false, reason: 'missing_signature_headers' };
	}

	const timestampSeconds = Number.parseInt(msgTimestamp, 10);
	if (!Number.isFinite(timestampSeconds)) {
		return { ok: false, reason: 'invalid_timestamp' };
	}
	const now = nowSeconds ?? Math.floor(Date.now() / 1000);
	if (Math.abs(now - timestampSeconds) > WEBHOOK_TIMESTAMP_TOLERANCE_S) {
		return { ok: false, reason: 'timestamp_out_of_tolerance' };
	}

	const expected = createHmac('sha256', decodeSecret(secret))
		.update(`${msgId}.${msgTimestamp}.${rawBody}`)
		.digest();

	// The header may carry several space-separated signatures (secret rotation).
	// Compare with timingSafeEqual so the check does not leak bits via timing.
	for (const candidate of msgSignature.split(' ')) {
		const parts = candidate.split(',');
		if (parts[0] !== 'v1' || !parts[1]) {
			continue;
		}
		let candidateBytes: Buffer;
		try {
			candidateBytes = Buffer.from(parts[1], 'base64');
		} catch {
			continue;
		}
		// timingSafeEqual throws on length mismatch; a wrong-length signature is
		// simply not a match.
		if (candidateBytes.length !== expected.length) {
			continue;
		}
		if (timingSafeEqual(candidateBytes, expected)) {
			return { ok: true };
		}
	}

	return { ok: false, reason: 'signature_mismatch' };
}

/**
 * The v1 event envelope, delivered from apiVersion `2026-07-07` onward.
 * Baseline (`2026-06-01`) deliveries and all v0 (colon-named) events are the
 * bare event object.
 */
export interface RoamWebhookEnvelope {
	type: string;
	eventId: string;
	timestamp?: string;
	apiVersion?: string;
	data: IDataObject;
}

/**
 * Detection keys on the envelope's own discriminators rather than the mere
 * presence of a `data` object, so a future event payload that legitimately
 * carries a `data` field is not silently unwrapped.
 */
export function isRoamWebhookEnvelope(body: unknown): body is RoamWebhookEnvelope {
	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		return false;
	}
	const candidate = body as Record<string, unknown>;
	return (
		typeof candidate.type === 'string' &&
		typeof candidate.eventId === 'string' &&
		typeof candidate.data === 'object' &&
		candidate.data !== null &&
		!Array.isArray(candidate.data)
	);
}

/** Return the event payload, whether the delivery is enveloped or bare. */
export function unwrapWebhookEnvelope(body: unknown): IDataObject {
	if (isRoamWebhookEnvelope(body)) {
		return body.data;
	}
	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		return {};
	}
	return body as IDataObject;
}

/**
 * Envelope metadata worth carrying onto the workflow item: `eventId` is stable
 * across Roam's delivery retries and across destinations, so it is the correct
 * de-dupe key for downstream nodes.
 */
export function webhookEnvelopeMeta(body: unknown): IDataObject {
	if (!isRoamWebhookEnvelope(body)) {
		return {};
	}
	return {
		eventType: body.type,
		eventId: body.eventId,
		eventTimestamp: body.timestamp,
		apiVersion: body.apiVersion,
	};
}
