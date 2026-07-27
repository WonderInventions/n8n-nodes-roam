import { describe, expect, it } from 'vitest';

import { Roam } from '../nodes/Roam/Roam.node';
import { create, list, prompt, transcript } from '../nodes/Roam/resources/meeting';
import { createContext } from './helpers/context';

const run = async (
	operation: (this: never, index: number) => Promise<unknown>,
	params: Record<string, unknown>,
	respond: () => unknown = () => ({}),
) => {
	const context = createContext({ params, respond });
	await operation.call(context as never, 0);
	return context;
};

describe('meeting: create meeting link', () => {
	it('uses the v1 route', async () => {
		const context = await run(create, {
			name: 'Standup',
			host: 'rob@ro.am',
			start: '2026-08-01T10:00:00',
			end: '2026-08-01T10:30:00',
		});

		expect(context.requests[0].method).toBe('POST');
		expect(context.requests[0].url).toBe('https://api.example.test/v1/meeting.link.create');
		expect(context.requests[0].body).toMatchObject({ name: 'Standup', host: 'rob@ro.am' });
	});

	it('converts n8n datetimes to RFC3339', async () => {
		const context = await run(create, {
			name: 'Standup',
			host: 'rob@ro.am',
			start: '2026-08-01T10:00:00',
			end: '2026-08-01T10:30:00',
		});

		const body = context.requests[0].body as Record<string, string>;
		expect(body.start).toMatch(/^2026-08-01T10:00:00/);
		expect(body.start).not.toBe('2026-08-01T10:00:00');
	});
});

describe('meeting: list', () => {
	it('reads the v1 meeting list', async () => {
		const context = await run(list, { limit: 25, expand: [] }, () => ({
			meetings: [{ id: 'mtg-1', title: 'Standup' }],
		}));

		expect(context.requests[0].url).toBe('https://api.example.test/v1/meeting.list');
		expect(context.requests[0].qs).toMatchObject({ limit: 25 });
	});

	it('joins expand fields into the comma-separated form the API expects', async () => {
		const context = await run(
			list,
			{ limit: 10, expand: ['summary', 'actionItems'] },
			() => ({ meetings: [] }),
		);

		expect((context.requests[0].qs as Record<string, string>).expand).toBe(
			'summary,actionItems',
		);
	});

	it('omits expand when nothing is selected', async () => {
		const context = await run(list, { limit: 10, expand: [] }, () => ({ meetings: [] }));
		expect(context.requests[0].qs).not.toHaveProperty('expand');
	});

	it('converts date filters to RFC3339', async () => {
		const context = await run(
			list,
			{ after: '2026-07-01T00:00:00', limit: 10, expand: [] },
			() => ({ meetings: [] }),
		);

		expect((context.requests[0].qs as Record<string, string>).after).toMatch(/^2026-07-01T/);
	});
});

describe('meeting: transcript and prompt', () => {
	it('reads transcript cues from the v1 route', async () => {
		const context = await run(transcript, { id: 'mtg-1' }, () => ({ id: 'mtg-1', cues: [] }));

		expect(context.requests[0].method).toBe('GET');
		expect(context.requests[0].url).toBe('https://api.example.test/v1/meeting.transcript');
		expect(context.requests[0].qs).toEqual({ id: 'mtg-1' });
	});

	it('prompts through the v1 route with a long timeout', async () => {
		const context = await run(
			prompt,
			{ id: 'mtg-1', prompt: 'What were the action items?' },
			() => ({ response: '...' }),
		);

		expect(context.requests[0].method).toBe('POST');
		expect(context.requests[0].url).toBe('https://api.example.test/v1/meeting.prompt');
		expect(context.requests[0].body).toEqual({
			id: 'mtg-1',
			prompt: 'What were the action items?',
		});
		// AI prompts routinely exceed the default HTTP timeout.
		expect((context.requests[0] as Record<string, unknown>).timeout).toBe(60000);
	});
});

describe('Roam node routing', () => {
	const node = new Roam();

	it('fails with migration guidance for the removed Transcript resource', async () => {
		// Silently emitting nothing (the previous fall-through behavior) would look
		// like "the meeting had no transcript" to a workflow author.
		const context = createContext({
			params: { resource: 'transcript', operation: 'list' },
			inputData: [{ json: {} }],
		});

		await expect(node.execute.call(context as never)).rejects.toThrow(
			/"Transcript" resource was removed/,
		);
		expect(context.requests).toHaveLength(0);
	});

	it('routes meeting operations to the right handler', async () => {
		const context = createContext({
			params: { resource: 'meeting', operation: 'transcript', id: 'mtg-1' },
			inputData: [{ json: {} }],
			respond: () => ({ id: 'mtg-1', cues: [] }),
		});

		await node.execute.call(context as never);

		expect(context.requests[0].url).toBe('https://api.example.test/v1/meeting.transcript');
	});

	it('offers the group picker from the v1 group list', async () => {
		const context = createContext({
			respond: () => ({ groups: [{ id: 'g-1', name: 'Engineering', type: 'standard' }] }),
		});

		const options = await node.methods.loadOptions.getGroups.call(context as never);

		expect(context.requests[0].url).toBe('https://api.example.test/v1/group.list');
		expect(options).toEqual([
			{ name: 'Engineering', value: 'g-1', description: 'standard' },
		]);
	});

	it('still understands the legacy bare-array group shape', async () => {
		const context = createContext({
			respond: () => [{ addressId: 'g-2', name: 'Sales', groupType: 'roam' }],
		});

		const options = await node.methods.loadOptions.getGroups.call(context as never);

		expect(options).toEqual([{ name: 'Sales', value: 'g-2', description: 'roam' }]);
	});
});
