import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
	applyChatPostDestination,
	toPlainUuid,
} from '../nodes/Roam/v2/resources/message/send';
import {
	buildWebhookSubscribeBody,
	unwrapWebhookPayload,
	V2_EVENT_MAP,
} from '../nodes/Roam/v2/webhook';

describe('toPlainUuid', () => {
	it('strips a tagged group prefix', () => {
		expect(toPlainUuid('G-a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe(
			'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
		);
	});

	it('leaves a bare UUID unchanged', () => {
		expect(toPlainUuid('a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe(
			'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
		);
	});
});

describe('applyChatPostDestination', () => {
	it('sets exactly one of groupId, chatId, userIds', () => {
		const group = applyChatPostDestination({}, 'group', 'G-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
		expect(group).toEqual({ groupId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' });
		expect(group).not.toHaveProperty('chatId');
		expect(group).not.toHaveProperty('userIds');

		const chat = applyChatPostDestination({}, 'chat', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
		expect(chat).toEqual({ chatId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' });

		const user = applyChatPostDestination({}, 'user', 'U-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
		expect(user).toEqual({ userIds: ['aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'] });
	});
});

describe('unwrapWebhookPayload', () => {
	it('spreads data and keeps the inner chat.message timestamp', () => {
		const unwrapped = unwrapWebhookPayload({
			type: 'chat.message',
			eventId: 'evt-1',
			timestamp: '2026-08-07T00:00:00.000000Z',
			apiVersion: '2026-08-07',
			data: {
				chatId: 'chat-1',
				text: 'hello',
				timestamp: 1751911425000000,
			},
		});

		expect(unwrapped.timestamp).toBe(1751911425000000);
		expect(unwrapped.eventType).toBe('chat.message');
		expect(unwrapped.eventId).toBe('evt-1');
		expect(unwrapped.apiVersion).toBe('2026-08-07');
		expect(unwrapped.chatId).toBe('chat-1');
	});

	it('passes a non-envelope body through', () => {
		const body = { recordingId: 'rec-1' };
		expect(unwrapWebhookPayload(body)).toEqual(body);
	});
});

describe('buildWebhookSubscribeBody', () => {
	it('omits an empty filter', () => {
		const body = buildWebhookSubscribeBody({
			url: 'https://example.com/hook',
			event: 'meetingEnded',
			apiVersion: '2026-08-07',
		});
		expect(body).toEqual({
			url: 'https://example.com/hook',
			event: 'meeting.ended',
			apiVersion: '2026-08-07',
		});
		expect(body).not.toHaveProperty('filter');
	});

	it('keeps hasVideo on New Recording', () => {
		const body = buildWebhookSubscribeBody({
			url: 'https://example.com/hook',
			event: 'recordingSaved',
			apiVersion: '2026-08-07',
		});
		expect(body.event).toBe('meeting.ended');
		expect(body.filter).toEqual({ hasVideo: true });
	});

	it('adds chat.message filters only when set', () => {
		const empty = buildWebhookSubscribeBody({
			url: 'https://example.com/hook',
			event: 'chatMessage',
			apiVersion: '2026-08-07',
		});
		expect(empty).not.toHaveProperty('filter');

		const filtered = buildWebhookSubscribeBody({
			url: 'https://example.com/hook',
			event: 'chatMessage',
			apiVersion: '2026-08-07',
			chatType: 'dm',
			mention: true,
		});
		expect(filtered.filter).toEqual({ chatType: 'dm', mention: true });
	});

	it('maps every v2 event to a dot-named API event', () => {
		for (const config of Object.values(V2_EVENT_MAP)) {
			expect(config.apiValue).toContain('.');
			expect(config.apiValue).not.toContain(':');
		}
	});
});

describe('typeVersion 1 endpoint lock', () => {
	const root = resolve(__dirname, '..');

	it('still posts text via chat.sendMessage and Block Kit via /v0/chat.post', () => {
		const send = readFileSync(
			resolve(root, 'nodes/Roam/v1/resources/message/send.ts'),
			'utf8',
		);
		expect(send).toContain("'/v1/chat.sendMessage'");
		expect(send).toContain("'/v0/chat.post'");
		expect(send).not.toContain("'/v1/chat.post'");
	});

	it('still manages webhooks on /v0 with colon-named events', () => {
		const trigger = readFileSync(resolve(root, 'nodes/Roam/v1/RoamTriggerV1.ts'), 'utf8');
		expect(trigger).toContain('"/v0/webhook.subscribe"');
		expect(trigger).toContain('"/v0/webhook.unsubscribe"');
		expect(trigger).toContain('"recording:saved"');
		expect(trigger).toContain('"transcript:saved"');
	});
});
