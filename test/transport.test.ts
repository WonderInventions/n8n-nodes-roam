import { describe, expect, it } from 'vitest';
import { NodeApiError } from 'n8n-workflow';

import { apiRequest, extractRoamErrorCode, toNodeApiError } from '../nodes/Roam/transport';
import { ROAM_API_VERSION, ROAM_USER_AGENT } from '../nodes/Roam/version';
import { createContext } from './helpers/context';

const node = { name: 'Roam', type: 'roam', typeVersion: 1 } as never;

describe('apiRequest', () => {
	it('pins the API version and advertises the plugin on every call', async () => {
		const context = createContext({ respond: () => ({ ok: true }) });

		await apiRequest.call(context as never, 'GET', '/v1/token.info');

		expect(context.requests[0].url).toBe('https://api.example.test/v1/token.info');
		expect(context.requests[0].headers).toMatchObject({
			'Roam-Version': ROAM_API_VERSION,
			'User-Agent': ROAM_USER_AGENT,
		});
	});

	it('pins a version that predates the subscribe-time verification handshake', () => {
		expect(ROAM_API_VERSION < '2026-07-23').toBe(true);
	});

	it('advertises the version from package.json', () => {
		expect(ROAM_USER_AGENT).toMatch(/^n8n-nodes-roam\/\d+\.\d+\.\d+/);
	});

	it('omits empty body and query objects', async () => {
		const context = createContext({ respond: () => ({}) });

		await apiRequest.call(context as never, 'GET', '/v1/group.list');

		expect(context.requests[0].body).toBeUndefined();
		expect(context.requests[0].qs).toBeUndefined();
	});

	it('falls back to the production base URL when the credential omits one', async () => {
		const context = createContext({
			credentials: { apiKey: 'k' },
			respond: () => ({}),
		});

		await apiRequest.call(context as never, 'GET', '/v1/token.info');

		expect(context.requests[0].url).toBe('https://api.ro.am/v1/token.info');
	});

	it('converts transport failures into a Roam-aware NodeApiError', async () => {
		const context = createContext({
			respond: () => {
				throw { statusCode: 401, error: { code: 'token_revoked', error: 'Token revoked' } };
			},
		});

		await expect(apiRequest.call(context as never, 'GET', '/v1/token.info')).rejects.toBeInstanceOf(
			NodeApiError,
		);
	});
});

describe('extractRoamErrorCode', () => {
	it('reads the v0 shape, where `code` is machine-readable', () => {
		expect(extractRoamErrorCode({ error: 'Token revoked: owner archived', code: 'token_revoked' })).toBe(
			'token_revoked',
		);
	});

	it('reads the v1 shape, where `error` is the code', () => {
		expect(extractRoamErrorCode({ ok: false, error: 'missing_scope' })).toBe('missing_scope');
	});

	it('does not mistake a v0 human sentence for a code', () => {
		expect(extractRoamErrorCode({ error: 'Could not process OAuth access token' })).toBeUndefined();
	});

	it('returns undefined for an empty body', () => {
		expect(extractRoamErrorCode(undefined)).toBeUndefined();
	});
});

describe('toNodeApiError', () => {
	it('surfaces re-auth guidance for a permanently dead token', () => {
		const error = toNodeApiError(node, {
			statusCode: 401,
			error: { code: 'token_revoked', error: 'Token revoked: owner archived' },
		});

		expect(error.message).toMatch(/revoked/i);
		expect(error.description).toMatch(/Create a new key/i);
	});

	it('distinguishes retry-later from stop-retrying transcript failures', () => {
		const pending = toNodeApiError(node, {
			statusCode: 404,
			error: { ok: false, error: 'transcript_pending' },
		});
		const unavailable = toNodeApiError(node, {
			statusCode: 404,
			error: { ok: false, error: 'transcript_unavailable' },
		});

		expect(pending.description).toMatch(/Retry later/i);
		expect(unavailable.description).toMatch(/Stop retrying/i);
	});

	it('passes an existing NodeApiError straight through', () => {
		const original = new NodeApiError(node, { message: 'boom' });
		expect(toNodeApiError(node, original)).toBe(original);
	});
});
