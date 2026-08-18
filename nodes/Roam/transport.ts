import { NodeApiError } from 'n8n-workflow';
import type {
	ICredentialDataDecryptedObject,
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	IWebhookFunctions,
	JsonObject,
} from 'n8n-workflow';

import { version } from '../../package.json';

type RoamFunctions = IExecuteFunctions | ILoadOptionsFunctions | IWebhookFunctions | IHookFunctions;

// Advertised to the Roam appserver on every request for version attribution in
// logs and Datadog (@plugin.name:n8n-nodes-roam / @plugin.version). Version is
// read from package.json so a release only bumps it in one place.
const ROAM_USER_AGENT = `n8n-nodes-roam/${version}`;

// Date-version pins sent as `Roam-Version`. Default is the published 0.1.14
// pin so node typeVersion 1 is unchanged. typeVersion 2 passes V2 explicitly.
export const ROAM_API_VERSION_V1 = '2026-06-01';
export const ROAM_API_VERSION_V2 = '2026-08-07';

/**
 * Machine-readable Roam API error codes that need a clear, actionable n8n
 * message. The API emits codes in two shapes:
 *
 * - v0: `{ "error": "<human sentence>", "code": "<code>" }`
 * - v1: `{ "ok": false, "error": "<code>" }`
 *
 * Permanent auth failures must surface re-auth guidance (do not look like a
 * transient retry). Transcript codes distinguish retry-later vs stop.
 */
const ROAM_ERROR_GUIDANCE: Record<string, { message: string; description: string }> = {
	token_revoked: {
		message: 'Roam API token has been revoked',
		description:
			'This API key is permanently unusable (owner archived/deleted or client archived). Create a new key in Roam Administration > Developer and update credentials — retrying with the same key will never succeed.',
	},
	invalid_token: {
		message: 'Roam API token is invalid or expired',
		description:
			'The bearer token is unknown, malformed, or expired. Obtain a new API key from Roam Administration > Developer and update credentials.',
	},
	not_authed: {
		message: 'Roam API authentication missing',
		description: 'No bearer token was provided. Check that Roam API credentials are configured on this node.',
	},
	invalid_auth: {
		message: 'Roam API authentication failed',
		description: 'Authentication failed. Check the API key and try again with a valid credential.',
	},
	transcript_pending: {
		message: 'Transcript is not ready yet',
		description:
			'The meeting is in progress or the transcript is still processing. Retry later (often after ~60s; honor Retry-After if present), or use a Roam Trigger (Meeting Ended) instead of polling.',
	},
	transcript_unavailable: {
		message: 'Transcript is unavailable',
		description:
			'This meeting was not transcribed and no transcript will become available. Stop retrying this request.',
	},
	transcript_not_found: {
		message: 'Transcript not found',
		description:
			'No transcript exists for this meeting. If the meeting recently ended, content may still be processing — prefer a Meeting Ended trigger rather than tight polling.',
	},
	meeting_not_found: {
		message: 'Meeting not found',
		description:
			'No meeting exists for this ID, or this API key cannot access it. Confirm the meeting ID and that the key has meetings:read.',
	},
	missing_scope: {
		message: 'Roam API key is missing a required scope',
		description:
			'The token lacks a scope required by this endpoint. Create a key with the needed permissions in Roam Administration > Developer.',
	},
	ratelimited: {
		message: 'Roam API rate limit exceeded',
		description: 'Too many requests. Wait and retry after a delay (honor Retry-After if present).',
	},
};

/**
 * Pull the JSON body out of the various shapes n8n/axios package HTTP failures in.
 */
function extractErrorBody(error: unknown): IDataObject | undefined {
	if (!error || typeof error !== 'object') {
		return undefined;
	}
	const err = error as IDataObject;

	// n8n httpRequest: { statusCode, error: <response body>, message: "401 - {...}" }
	const nested = err.error;
	if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
		return nested as IDataObject;
	}
	if (typeof nested === 'string') {
		try {
			const parsed = JSON.parse(nested) as unknown;
			if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
				return parsed as IDataObject;
			}
		} catch {
			// not JSON
		}
	}

	// Axios-style: response.data
	const response = err.response as IDataObject | undefined;
	if (response && typeof response === 'object') {
		const data = response.data;
		if (data && typeof data === 'object' && !Array.isArray(data)) {
			return data as IDataObject;
		}
	}

	// Already a body-shaped object
	if (typeof err.code === 'string' || typeof err.error === 'string' || err.ok === false) {
		return err;
	}

	return undefined;
}

/**
 * Resolve the machine-readable Roam error code from a mixed v0/v1 body.
 *
 * - v0: code lives in `code`; `error` is the human sentence
 * - v1: `ok:false` and `error` is the code
 * - Fallback: if `error` is a known catalog code, treat it as the code
 */
export function extractRoamErrorCode(body: IDataObject | undefined): string | undefined {
	if (!body) {
		return undefined;
	}

	const codeField = body.code;
	if (typeof codeField === 'string' && codeField.length > 0) {
		return codeField;
	}

	const errorField = body.error;
	if (typeof errorField !== 'string' || errorField.length === 0) {
		return undefined;
	}

	// v1 error body: ok is false and error is the machine code
	if (body.ok === false) {
		return errorField;
	}

	// Known catalog code, or a machine-readable token (snake_case / lowercase, no spaces).
	// v0 human sentences have spaces/capitals and do not match.
	if (ROAM_ERROR_GUIDANCE[errorField] || /^[a-z][a-z0-9_]*$/.test(errorField)) {
		return errorField;
	}

	return undefined;
}

function humanMessageFromBody(body: IDataObject | undefined, code: string | undefined): string | undefined {
	if (!body) {
		return undefined;
	}
	const errorField = body.error;
	if (typeof errorField !== 'string' || errorField.length === 0) {
		return undefined;
	}
	// v0: error is the human sentence; v1: error is the code (skip as human text)
	if (code && errorField === code) {
		return undefined;
	}
	if (body.ok === false) {
		return undefined;
	}
	return errorField;
}

function httpStatusFromError(error: unknown): string | undefined {
	if (!error || typeof error !== 'object') {
		return undefined;
	}
	const err = error as IDataObject;
	const status = err.statusCode ?? err.status ?? err.httpCode;
	if (typeof status === 'number' || typeof status === 'string') {
		return String(status);
	}
	return undefined;
}

/**
 * Convert a thrown HTTP/API failure into a NodeApiError with Roam-specific
 * guidance for auth and transcript codes.
 */
export function toNodeApiError(node: ReturnType<RoamFunctions['getNode']>, error: unknown): NodeApiError {
	if (error instanceof NodeApiError) {
		return error;
	}

	const body = extractErrorBody(error);
	const code = extractRoamErrorCode(body);
	const httpCode = httpStatusFromError(error);
	const apiHuman = humanMessageFromBody(body, code);
	const guidance = code ? ROAM_ERROR_GUIDANCE[code] : undefined;

	const options: {
		message?: string;
		description?: string;
		httpCode?: string;
	} = {};

	if (httpCode) {
		options.httpCode = httpCode;
	}

	if (guidance) {
		options.message = guidance.message;
		// Keep the API sentence when present (v0 often has a useful detail).
		options.description = apiHuman
			? `${guidance.description} (API: ${apiHuman})`
			: guidance.description;
	} else if (apiHuman) {
		options.message = `Roam API error${code ? ` (${code})` : ''}: ${apiHuman}`;
		if (code) {
			options.description = `Error code: ${code}`;
		}
	} else if (code) {
		options.message = `Roam API error: ${code}`;
	}

	const errorResponse = (typeof error === 'object' && error !== null ? error : { message: String(error) }) as JsonObject;

	return new NodeApiError(node, errorResponse, options);
}

/**
 * Make an API request to Roam
 */
export type RoamRequestOptions = Partial<IHttpRequestOptions> & {
	roamVersion?: string;
};

export async function apiRequest(
	this: RoamFunctions,
	method: 'GET' | 'POST' | 'PUT' | 'DELETE',
	endpoint: string,
	body: IDataObject = {},
	qs: IDataObject = {},
	optionOverrides: RoamRequestOptions = {},
) {
	const credentials = (await this.getCredentials('roamApi')) as
		| (ICredentialDataDecryptedObject & { baseUrl?: string })
		| undefined;

	if (!credentials) {
		throw new Error('No credentials returned for Roam API');
	}

	const baseUrl = (credentials.baseUrl as string | undefined) ?? 'https://api.ro.am';
	const { roamVersion = ROAM_API_VERSION_V1, ...httpOverrides } = optionOverrides;

	const requestOptions: IHttpRequestOptions = {
		method: method as IHttpRequestMethods,
		url: `${baseUrl}${endpoint}`,
		json: true,
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			'User-Agent': ROAM_USER_AGENT,
			'Roam-Version': roamVersion,
		},
		body,
		qs,
		...httpOverrides,
	};

	if (Object.keys(requestOptions.body as IDataObject).length === 0) {
		delete requestOptions.body;
	}

	if (Object.keys(requestOptions.qs as IDataObject).length === 0) {
		delete requestOptions.qs;
	}

	try {
		return await this.helpers.httpRequestWithAuthentication.call(this, 'roamApi', requestOptions);
	} catch (error) {
		throw toNodeApiError(this.getNode(), error);
	}
}

const LIST_ALL_PAGES_MAX = 50;

/**
 * Walk a cursor-paginated v1 list endpoint and return every item.
 * Used by dropdown loaders (groups, users) so the picker is complete.
 */
export async function apiRequestAllPages(
	this: RoamFunctions,
	endpoint: string,
	listKey: string,
	qs: IDataObject = {},
	roamVersion: string = ROAM_API_VERSION_V1,
): Promise<IDataObject[]> {
	const items: IDataObject[] = [];
	let cursor: string | undefined;
	const limit = typeof qs.limit === 'number' ? qs.limit : 100;

	for (let page = 0; page < LIST_ALL_PAGES_MAX; page++) {
		const pageQs: IDataObject = { ...qs, limit };
		if (cursor) {
			pageQs.cursor = cursor;
		}

		const response = (await apiRequest.call(this, 'GET', endpoint, {}, pageQs, {
			roamVersion,
		})) as IDataObject;
		const pageItems = (response[listKey] as IDataObject[]) ?? [];
		items.push(...pageItems);

		const next = response.nextCursor;
		if (typeof next !== 'string' || next.length === 0 || pageItems.length === 0) {
			break;
		}
		cursor = next;
	}

	return items;
}
