import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { RoamTrigger } from '../nodes/Roam/RoamTrigger.node';
import { ROAM_API_VERSION } from '../nodes/Roam/version';
import { createContext } from './helpers/context';

const SECRET = 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw';

const node = new RoamTrigger();
const hooks = node.webhookMethods.default;

const sign = (msgId: string, timestamp: number, body: string) => {
	const key = Buffer.from(SECRET.slice('whsec_'.length), 'base64');
	return `v1,${createHmac('sha256', key).update(`${msgId}.${timestamp}.${body}`).digest('base64')}`;
};

const subscribeCall = async (params: Record<string, unknown>) => {
	const context = createContext({
		params,
		respond: () => ({ id: 'sub-1' }),
	});
	await hooks.create.call(context as never);
	return context;
};

describe('RoamTrigger subscribe routing', () => {
	it('subscribes v1 events through /v1 with an explicit apiVersion pin', async () => {
		const context = await subscribeCall({ event: 'chatMessage', chatScope: 'all' });

		expect(context.requests).toHaveLength(1);
		expect(context.requests[0].method).toBe('POST');
		expect(context.requests[0].url).toBe('https://api.example.test/v1/webhook.subscribe');
		expect(context.requests[0].body).toMatchObject({
			event: 'chat.message',
			// Without this pin the subscription freezes at the API client's account
			// default, which moves under us and silently changes payload shapes.
			apiVersion: ROAM_API_VERSION,
		});
	});

	it('pins below the version that requires a subscribe-time URL handshake', () => {
		// From 2026-07-23 Roam POSTs a signed webhook.verification challenge and
		// only persists the subscription if the endpoint echoes it. n8n does not
		// serve its webhook URL until the workflow is active, which is after the
		// create hook runs, so the handshake cannot complete.
		expect(ROAM_API_VERSION < '2026-07-23').toBe(true);
	});

	it('subscribes meeting.ended through /v1', async () => {
		const context = await subscribeCall({ event: 'meetingEnded' });
		expect(context.requests[0].url).toBe('https://api.example.test/v1/webhook.subscribe');
		expect((context.requests[0].body as Record<string, unknown>).event).toBe('meeting.ended');
	});

	it.each([
		['recordingSaved', 'recording:saved'],
		['transcriptSaved', 'transcript:saved'],
	])('keeps %s on /v0 because %s has no dot-named equivalent', async (event, apiValue) => {
		const context = await subscribeCall({ event });

		expect(context.requests[0].url).toBe('https://api.example.test/v0/webhook.subscribe');
		expect(context.requests[0].body).toEqual({
			url: 'https://n8n.example.test/webhook/roam',
			event: apiValue,
		});
		// v0 events are not date-versioned; /v0 discards the pin anyway.
		expect(context.requests[0].body).not.toHaveProperty('apiVersion');
	});

	it('sends no filter for an unconstrained chat.message subscription', async () => {
		// Roam rejects an empty filter object with a 400.
		const context = await subscribeCall({
			event: 'chatMessage',
			chatScope: 'all',
			mentionOnly: false,
		});
		expect(context.requests[0].body).not.toHaveProperty('filter');
	});

	it('maps the chat scope and mention toggle onto the server-side filter', async () => {
		const dm = await subscribeCall({ event: 'chatMessage', chatScope: 'dm' });
		expect((dm.requests[0].body as Record<string, unknown>).filter).toEqual({ chatType: 'dm' });

		const mentions = await subscribeCall({
			event: 'chatMessage',
			chatScope: 'group',
			mentionOnly: true,
		});
		expect((mentions.requests[0].body as Record<string, unknown>).filter).toEqual({
			chatType: 'group',
			mention: true,
		});
	});

	it('sends hasVideo only when the user opts in', async () => {
		// {"hasVideo": false} is rejected by the server; omit the filter instead.
		const off = await subscribeCall({ event: 'meetingEnded', hasVideoOnly: false });
		expect(off.requests[0].body).not.toHaveProperty('filter');

		const on = await subscribeCall({ event: 'meetingEnded', hasVideoOnly: true });
		expect((on.requests[0].body as Record<string, unknown>).filter).toEqual({ hasVideo: true });
	});

	it('records the subscription id for teardown', async () => {
		const context = await subscribeCall({ event: 'chatMessage' });
		expect(context.staticData.webhookId).toBe('sub-1');
	});

	it('rejects an unknown event rather than subscribing to nothing', async () => {
		const context = createContext({ params: { event: 'notAnEvent' } });
		await expect(hooks.create.call(context as never)).rejects.toThrow(/Unsupported Roam event/);
	});
});

describe('RoamTrigger teardown', () => {
	it('POSTs /v1/webhook.unsubscribe with a JSON body id', async () => {
		// Both unsubscribe routes are registered POST-only: a DELETE 405s and
		// leaves the subscription row behind.
		const context = createContext({
			staticData: { webhookId: 'sub-1' },
			respond: () => ({}),
		});

		await hooks.delete.call(context as never);

		expect(context.requests).toHaveLength(1);
		expect(context.requests[0].method).toBe('POST');
		expect(context.requests[0].url).toBe('https://api.example.test/v1/webhook.unsubscribe');
		expect(context.requests[0].body).toEqual({ id: 'sub-1' });
		expect(context.requests[0].qs).toBeUndefined();
	});

	it('clears the stored subscription so a re-enable does not reuse a dead id', async () => {
		const context = createContext({
			staticData: { webhookId: 'sub-1', webhookUrl: 'https://old' },
			respond: () => ({}),
		});

		await hooks.delete.call(context as never);

		expect(context.staticData.webhookId).toBeUndefined();
		expect(context.staticData.webhookUrl).toBeUndefined();
	});

	it('is idempotent when there is no stored subscription', async () => {
		const context = createContext({ staticData: {} });
		await expect(hooks.delete.call(context as never)).resolves.toBe(true);
		expect(context.requests).toHaveLength(0);
	});
});

describe('RoamTrigger webhook delivery', () => {
	const message = { chatId: 'chat-1', text: 'hello', chatType: 'group' };
	const envelope = {
		type: 'chat.message',
		eventId: '0197f9a1-7d2e-7cc3-9f6a-8b1c2d3e4f5a',
		timestamp: '2026-07-07T18:23:45.000000Z',
		apiVersion: '2026-07-07',
		data: message,
	};

	it('unwraps the v1 envelope and carries its metadata onto the item', async () => {
		const context = createContext({ body: envelope, credentials: { apiKey: 'k' } });

		const result = await node.webhook.call(context as never);

		expect(result.workflowData?.[0][0].json).toMatchObject({
			chatId: 'chat-1',
			text: 'hello',
			eventType: 'chat.message',
			eventId: '0197f9a1-7d2e-7cc3-9f6a-8b1c2d3e4f5a',
		});
		// The envelope wrapper itself must not leak through.
		expect(result.workflowData?.[0][0].json).not.toHaveProperty('data');
	});

	it('passes a bare v0 delivery through unchanged', async () => {
		const bare = { recordingId: 'rec-1', videoUrl: 'https://ro.am/v.mp4' };
		const context = createContext({ body: bare, credentials: { apiKey: 'k' } });

		const result = await node.webhook.call(context as never);

		expect(result.workflowData?.[0][0].json).toEqual(bare);
	});

	it('accepts a correctly signed delivery when a signing secret is configured', async () => {
		const rawBody = JSON.stringify(envelope);
		const timestamp = Math.floor(Date.now() / 1000);
		const context = createContext({
			body: envelope,
			rawBody,
			headers: {
				'webhook-id': envelope.eventId,
				'webhook-timestamp': String(timestamp),
				'webhook-signature': sign(envelope.eventId, timestamp, rawBody),
			},
			credentials: { apiKey: 'k', webhookSigningSecret: SECRET },
		});

		const result = await node.webhook.call(context as never);

		expect(context.responseStatus).toBeUndefined();
		expect(result.workflowData?.[0][0].json).toMatchObject({ chatId: 'chat-1' });
	});

	it('refuses to start the workflow on a forged delivery', async () => {
		const forged = {
			type: 'lobby.booked',
			eventId: 'e1',
			data: { booking: { id: 'attacker-supplied' } },
		};
		const context = createContext({
			body: forged,
			rawBody: JSON.stringify(forged),
			headers: {},
			credentials: { apiKey: 'k', webhookSigningSecret: SECRET },
		});

		const result = await node.webhook.call(context as never);

		expect(result.workflowData).toBeUndefined();
		expect(context.responseStatus).toBe(401);
		expect(context.responseBody).toMatchObject({
			error: 'invalid_signature',
			reason: 'missing_signature_headers',
		});
	});

	it('rejects a delivery signed with the wrong secret', async () => {
		const rawBody = JSON.stringify(envelope);
		const timestamp = Math.floor(Date.now() / 1000);
		const context = createContext({
			body: envelope,
			rawBody,
			headers: {
				'webhook-id': envelope.eventId,
				'webhook-timestamp': String(timestamp),
				'webhook-signature': 'v1,d3Jvbmctc2lnbmF0dXJlLXZhbHVl',
			},
			credentials: { apiKey: 'k', webhookSigningSecret: SECRET },
		});

		const result = await node.webhook.call(context as never);

		expect(result.workflowData).toBeUndefined();
		expect(context.responseStatus).toBe(401);
	});

	it('verifies against a Buffer rawBody, which is how n8n exposes it', async () => {
		const rawBody = JSON.stringify(envelope);
		const timestamp = Math.floor(Date.now() / 1000);
		const context = createContext({
			body: envelope,
			rawBody: Buffer.from(rawBody, 'utf8'),
			headers: {
				'webhook-id': envelope.eventId,
				'webhook-timestamp': String(timestamp),
				'webhook-signature': sign(envelope.eventId, timestamp, rawBody),
			},
			credentials: { apiKey: 'k', webhookSigningSecret: SECRET },
		});

		const result = await node.webhook.call(context as never);

		expect(context.responseStatus).toBeUndefined();
		expect(result.workflowData?.[0][0].json).toMatchObject({ chatId: 'chat-1' });
	});

	it('skips verification when no signing secret is configured', async () => {
		// Existing installs have no secret in their credential yet; requiring one
		// outright would break every live workflow on upgrade.
		const context = createContext({
			body: envelope,
			headers: {},
			credentials: { apiKey: 'k' },
		});

		const result = await node.webhook.call(context as never);

		expect(context.responseStatus).toBeUndefined();
		expect(result.workflowData?.[0][0].json).toMatchObject({ chatId: 'chat-1' });
	});

	it('declares rawBody so the signed bytes are available', () => {
		// Without this the request body is only available parsed, and re-serializing
		// it changes key order and whitespace, so no signature would ever verify.
		expect(node.description.webhooks?.[0].rawBody).toBe(true);
	});
});

describe('RoamTrigger manual execution', () => {
	it('samples recordings from the v1 endpoint', async () => {
		const context = createContext({
			params: { event: 'recordingSaved' },
			inputData: [],
			respond: () => ({ recordings: [{ recordingId: 'rec-1' }] }),
		});

		const result = await node.execute.call(context as never);

		expect(context.requests[0].url).toBe('https://api.example.test/v1/recording.list');
		expect(result[0][0].json).toEqual({ recordingId: 'rec-1' });
	});

	it('samples meetings from the v1 endpoint for meeting.ended', async () => {
		const context = createContext({
			params: { event: 'meetingEnded' },
			inputData: [],
			respond: () => ({ meetings: [{ id: 'mtg-1' }] }),
		});

		await node.execute.call(context as never);

		expect(context.requests[0].url).toBe('https://api.example.test/v1/meeting.list');
	});

	it('samples chat history from the chosen group', async () => {
		const context = createContext({
			params: { event: 'chatMessage', sampleGroupId: 'group-1' },
			inputData: [],
			respond: () => ({ messages: [{ chatId: 'chat-1', text: 'hi' }] }),
		});

		const result = await node.execute.call(context as never);

		expect(context.requests[0].url).toBe('https://api.example.test/v1/chat.history');
		expect(context.requests[0].qs).toMatchObject({ groupId: 'group-1' });
		expect(result[0][0].json).toMatchObject({ text: 'hi' });
	});

	it('returns nothing rather than a 400 when no sample group is chosen', async () => {
		const context = createContext({
			params: { event: 'chatMessage', sampleGroupId: '' },
			inputData: [],
		});

		const result = await node.execute.call(context as never);

		expect(context.requests).toHaveLength(0);
		expect(result[0]).toEqual([]);
	});
});
