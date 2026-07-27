import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
	WEBHOOK_TIMESTAMP_TOLERANCE_S,
	headerValue,
	isRoamWebhookEnvelope,
	unwrapWebhookEnvelope,
	verifyStandardWebhookSignature,
	webhookEnvelopeMeta,
} from '../nodes/Roam/webhooks';

const SECRET = 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw';
const BODY = '{"type":"chat.message","eventId":"e1","data":{"text":"hi"}}';

const sign = (secret: string, msgId: string, timestamp: number | string, body: string) => {
	const key = Buffer.from(secret.startsWith('whsec_') ? secret.slice(6) : secret, 'base64');
	return createHmac('sha256', key).update(`${msgId}.${timestamp}.${body}`).digest('base64');
};

const signedHeaders = ({
	secret = SECRET,
	msgId = '0197f9a1-7d2e-7cc3-9f6a-8b1c2d3e4f5a',
	timestamp = Math.floor(Date.now() / 1000),
	body = BODY,
	lowercase = true,
} = {}) => {
	const signature = `v1,${sign(secret, msgId, timestamp, body)}`;
	return lowercase
		? {
				'webhook-id': msgId,
				'webhook-timestamp': String(timestamp),
				'webhook-signature': signature,
			}
		: {
				'Webhook-Id': msgId,
				'Webhook-Timestamp': String(timestamp),
				'Webhook-Signature': signature,
			};
};

describe('headerValue', () => {
	it('finds headers regardless of case', () => {
		expect(headerValue({ 'Webhook-Id': 'abc' }, 'webhook-id')).toBe('abc');
		expect(headerValue({ 'webhook-id': 'abc' }, 'Webhook-Id')).toBe('abc');
	});

	it('takes the first value of a repeated header', () => {
		expect(headerValue({ 'webhook-signature': ['a', 'b'] }, 'webhook-signature')).toBe('a');
	});

	it('returns undefined for missing headers and non-objects', () => {
		expect(headerValue({}, 'webhook-id')).toBeUndefined();
		expect(headerValue(undefined, 'webhook-id')).toBeUndefined();
	});
});

describe('verifyStandardWebhookSignature', () => {
	it('accepts a correctly signed delivery', () => {
		expect(verifyStandardWebhookSignature(SECRET, signedHeaders(), BODY)).toEqual({ ok: true });
	});

	it('accepts Title-Cased headers', () => {
		expect(
			verifyStandardWebhookSignature(SECRET, signedHeaders({ lowercase: false }), BODY).ok,
		).toBe(true);
	});

	it('accepts a secret without the whsec_ prefix', () => {
		const bare = SECRET.slice('whsec_'.length);
		expect(
			verifyStandardWebhookSignature(bare, signedHeaders({ secret: bare }), BODY).ok,
		).toBe(true);
	});

	it('accepts when one of several space-separated signatures matches', () => {
		const headers = signedHeaders();
		headers['webhook-signature'] =
			`v1,bm90LXRoZS1yaWdodC1vbmU= ${headers['webhook-signature']}`;
		expect(verifyStandardWebhookSignature(SECRET, headers, BODY).ok).toBe(true);
	});

	it('rejects a tampered body', () => {
		const tampered = BODY.replace('hi', 'transfer $10000');
		expect(verifyStandardWebhookSignature(SECRET, signedHeaders(), tampered)).toEqual({
			ok: false,
			reason: 'signature_mismatch',
		});
	});

	it('rejects a forged delivery with no signature headers', () => {
		expect(verifyStandardWebhookSignature(SECRET, {}, BODY)).toEqual({
			ok: false,
			reason: 'missing_signature_headers',
		});
	});

	it('rejects a replay outside the timestamp tolerance', () => {
		const now = Math.floor(Date.now() / 1000);
		const stale = now - WEBHOOK_TIMESTAMP_TOLERANCE_S - 1;
		expect(
			verifyStandardWebhookSignature(SECRET, signedHeaders({ timestamp: stale }), BODY, now),
		).toEqual({ ok: false, reason: 'timestamp_out_of_tolerance' });
	});

	it('accepts a delivery exactly at the tolerance edge', () => {
		const now = Math.floor(Date.now() / 1000);
		const edge = now - WEBHOOK_TIMESTAMP_TOLERANCE_S;
		expect(
			verifyStandardWebhookSignature(SECRET, signedHeaders({ timestamp: edge }), BODY, now).ok,
		).toBe(true);
	});

	it('rejects a non-numeric timestamp', () => {
		const headers = signedHeaders();
		headers['webhook-timestamp'] = 'not-a-number';
		expect(verifyStandardWebhookSignature(SECRET, headers, BODY)).toEqual({
			ok: false,
			reason: 'invalid_timestamp',
		});
	});

	it('rejects a wrong-length signature without throwing', () => {
		// timingSafeEqual throws on length mismatch, so the implementation must
		// length-check first or a short signature crashes the workflow instead of
		// failing verification.
		const headers = signedHeaders();
		headers['webhook-signature'] = 'v1,YWJj';
		expect(() => verifyStandardWebhookSignature(SECRET, headers, BODY)).not.toThrow();
		expect(verifyStandardWebhookSignature(SECRET, headers, BODY).ok).toBe(false);
	});

	it('rejects a signature made with a different secret', () => {
		const headers = signedHeaders({ secret: 'whsec_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' });
		expect(verifyStandardWebhookSignature(SECRET, headers, BODY).ok).toBe(false);
	});

	it('rejects when the raw body was not captured', () => {
		expect(verifyStandardWebhookSignature(SECRET, signedHeaders(), undefined)).toEqual({
			ok: false,
			reason: 'no_raw_body',
		});
	});

	it('rejects when no secret is configured', () => {
		expect(verifyStandardWebhookSignature('', signedHeaders(), BODY)).toEqual({
			ok: false,
			reason: 'no_secret_configured',
		});
	});
});

describe('unwrapWebhookEnvelope', () => {
	const envelope = {
		type: 'onair.guest.added',
		eventId: '0197f9a1-7d2e-7cc3-9f6a-8b1c2d3e4f5a',
		timestamp: '2026-07-07T18:23:45.000000Z',
		apiVersion: '2026-07-07',
		data: { guests: [{ id: 'gst_1' }], event: { id: 'evt_1' } },
	};

	it('unwraps a v1 envelope to its data payload', () => {
		expect(isRoamWebhookEnvelope(envelope)).toBe(true);
		expect(unwrapWebhookEnvelope(envelope)).toEqual(envelope.data);
	});

	it('passes a bare (v0 or baseline) payload through unchanged', () => {
		const bare = { recordingId: 'rec_1', videoUrl: 'https://ro.am/v.mp4' };
		expect(isRoamWebhookEnvelope(bare)).toBe(false);
		expect(unwrapWebhookEnvelope(bare)).toEqual(bare);
	});

	it('does not unwrap a payload that merely has a data field', () => {
		const notEnvelope = { id: 'x', data: { nested: true } };
		expect(unwrapWebhookEnvelope(notEnvelope)).toEqual(notEnvelope);
	});

	it('handles null, undefined, and arrays', () => {
		expect(unwrapWebhookEnvelope(undefined)).toEqual({});
		expect(unwrapWebhookEnvelope(null)).toEqual({});
		expect(unwrapWebhookEnvelope([1, 2])).toEqual({});
	});

	it('exposes envelope metadata, including the retry-stable eventId', () => {
		expect(webhookEnvelopeMeta(envelope)).toEqual({
			eventType: 'onair.guest.added',
			eventId: '0197f9a1-7d2e-7cc3-9f6a-8b1c2d3e4f5a',
			eventTimestamp: '2026-07-07T18:23:45.000000Z',
			apiVersion: '2026-07-07',
		});
	});

	it('returns no metadata for a bare payload', () => {
		expect(webhookEnvelopeMeta({ recordingId: 'rec_1' })).toEqual({});
	});
});
