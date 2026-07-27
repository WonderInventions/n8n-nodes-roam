import { describe, expect, it } from 'vitest';

import { send, toAddressId } from '../nodes/Roam/resources/message/send';
import { createContext } from './helpers/context';

const baseParams = {
	groupId: '9003ec0e-ea7d-41b4-93cf-ef42d730f771',
	botName: 'n8n',
	senderImageUrl: '',
};

const sendWith = async (params: Record<string, unknown>) => {
	const context = createContext({
		params: { ...baseParams, ...params },
		respond: () => ({ ok: true, chatId: 'chat-1', timestamp: 1751911425000000 }),
	});
	await send.call(context as never, 0);
	return context;
};

describe('toAddressId', () => {
	it('strips a legacy tagged group id', () => {
		expect(toAddressId('G-9003ec0e-ea7d-41b4-93cf-ef42d730f771')).toBe(
			'9003ec0e-ea7d-41b4-93cf-ef42d730f771',
		);
	});

	it('leaves a plain UUID alone', () => {
		expect(toAddressId('9003ec0e-ea7d-41b4-93cf-ef42d730f771')).toBe(
			'9003ec0e-ea7d-41b4-93cf-ef42d730f771',
		);
	});
});

describe('message: send', () => {
	it('posts plain text to /v1/chat.post', async () => {
		// Replaces the deprecated /v1/chat.sendMessage.
		const context = await sendWith({ messageFormatting: 'plain', text: 'hello' });

		expect(context.requests).toHaveLength(1);
		expect(context.requests[0].method).toBe('POST');
		expect(context.requests[0].url).toBe('https://api.example.test/v1/chat.post');
		expect(context.requests[0].body).toMatchObject({
			groupId: baseParams.groupId,
			text: 'hello',
			markdown: false,
		});
	});

	it('marks markdown messages as markdown', async () => {
		const context = await sendWith({ messageFormatting: 'markdown', text: '**hi**' });
		expect((context.requests[0].body as Record<string, unknown>).markdown).toBe(true);
	});

	it('posts Block Kit messages to /v1/chat.post too', async () => {
		// Previously these went to /v0/chat.post while text went to v1, so a single
		// node spoke two API generations at once.
		const context = await sendWith({
			messageFormatting: 'blocks_json',
			blocksJson: '[{"type":"section","text":{"type":"mrkdwn","text":"hi"}}]',
			colorPreset: 'good',
		});

		expect(context.requests[0].url).toBe('https://api.example.test/v1/chat.post');
		expect(context.requests[0].body).toMatchObject({
			groupId: baseParams.groupId,
			color: 'good',
		});
	});

	it('never sends the v0 tagged `chat` field, which /v1 rejects outright', async () => {
		const context = await sendWith({ messageFormatting: 'plain', text: 'hello' });
		expect(context.requests[0].body).not.toHaveProperty('chat');
		expect(context.requests[0].body).not.toHaveProperty('recipients');
	});

	it('normalizes a legacy tagged group id supplied by an expression', async () => {
		const context = await sendWith({
			groupId: `G-${baseParams.groupId}`,
			messageFormatting: 'plain',
			text: 'hello',
		});
		expect((context.requests[0].body as Record<string, unknown>).groupId).toBe(
			baseParams.groupId,
		);
	});

	it('builds a simple Block Kit layout with header, body, context, and buttons', async () => {
		const context = await sendWith({
			messageFormatting: 'blocks_simple',
			headerText: 'Deploy',
			bodyText: 'Shipped to prod',
			bodyFormat: 'mrkdwn',
			contextText: 'by CI',
			actions: { button1Label: 'View', button1Url: 'https://example.test' },
			colorPreset: '',
		});

		const blocks = (context.requests[0].body as Record<string, unknown>).blocks as Array<
			Record<string, unknown>
		>;
		expect(blocks.map((block) => block.type)).toEqual([
			'header',
			'section',
			'context',
			'actions',
		]);
	});

	it('rejects a button with a label but no URL', async () => {
		await expect(
			sendWith({
				messageFormatting: 'blocks_simple',
				bodyText: 'body',
				actions: { button1Label: 'View' },
				colorPreset: '',
			}),
		).rejects.toThrow(/requires both label and URL/);
	});

	it('rejects a custom hex colour that is not #RRGGBB', async () => {
		await expect(
			sendWith({
				messageFormatting: 'blocks_json',
				blocksJson: '[]',
				colorPreset: 'custom',
				customHex: 'green',
			}),
		).rejects.toThrow(/#RRGGBB/);
	});

	it('rejects Blocks JSON that is not an array', async () => {
		await expect(
			sendWith({
				messageFormatting: 'blocks_json',
				blocksJson: '{"type":"section"}',
				colorPreset: '',
			}),
		).rejects.toThrow(/JSON array of blocks/);
	});
});
