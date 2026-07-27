import type { IDataObject } from 'n8n-workflow';

/**
 * Minimal stand-ins for the n8n execution contexts.
 *
 * The node only touches a small, stable slice of each interface, so hand-rolled
 * fakes keep the tests readable and free of an n8n runtime. Every fake records
 * the HTTP calls the node attempted so tests can assert on route, method, body,
 * and query string — which is where the v0/v1 migration bugs live.
 */

export interface RecordedRequest {
	method: string;
	url: string;
	headers?: Record<string, unknown>;
	body?: unknown;
	qs?: unknown;
}

export interface FakeContextOptions {
	params?: Record<string, unknown>;
	credentials?: IDataObject;
	webhookUrl?: string;
	staticData?: IDataObject;
	respond?: (request: RecordedRequest) => unknown;
	body?: unknown;
	headers?: Record<string, unknown>;
	rawBody?: string | Buffer;
	inputData?: Array<{ json: IDataObject }>;
}

export interface FakeContext {
	requests: RecordedRequest[];
	staticData: IDataObject;
	responseStatus?: number;
	responseBody?: unknown;
	[key: string]: unknown;
}

const DEFAULT_CREDENTIALS: IDataObject = {
	apiKey: 'test-key',
	baseUrl: 'https://api.example.test',
};

export function createContext(options: FakeContextOptions = {}): FakeContext {
	const requests: RecordedRequest[] = [];
	const params = options.params ?? {};
	const staticData: IDataObject = options.staticData ?? {};

	const context: FakeContext = {
		requests,
		staticData,

		getNode: () => ({ name: 'Roam', type: 'roam', typeVersion: 1 }),

		// IExecuteFunctions passes (name, itemIndex, fallback); IHookFunctions and
		// IWebhookFunctions pass (name, fallback). Accept both by treating a
		// numeric second argument as the item index.
		getNodeParameter: (name: string, second?: unknown, third?: unknown) => {
			const fallback = typeof second === 'number' ? third : second;
			return name in params ? params[name] : fallback;
		},

		getCredentials: async () => options.credentials ?? DEFAULT_CREDENTIALS,

		getNodeWebhookUrl: () => options.webhookUrl ?? 'https://n8n.example.test/webhook/roam',

		getWorkflowStaticData: () => staticData,

		getInputData: (index?: number) =>
			options.inputData ?? (typeof index === 'number' ? [{ json: {} }] : []),

		continueOnFail: () => false,

		getBodyData: () => options.body ?? {},

		getHeaderData: () => options.headers ?? {},

		getRequestObject: () => ({ rawBody: options.rawBody }),

		getResponseObject: () => ({
			status(code: number) {
				context.responseStatus = code;
				return this;
			},
			json(payload: unknown) {
				context.responseBody = payload;
				return this;
			},
		}),

		helpers: {
			httpRequestWithAuthentication: async (
				_credentialType: string,
				requestOptions: RecordedRequest,
			) => {
				requests.push(requestOptions);
				return options.respond ? options.respond(requestOptions) : {};
			},
			returnJsonArray: (items: IDataObject | IDataObject[]) =>
				(Array.isArray(items) ? items : [items]).map((json) => ({ json })),
			constructExecutionMetaData: (
				data: Array<{ json: IDataObject }>,
				meta: { itemData: { item: number } },
			) => data.map((entry) => ({ ...entry, pairedItem: meta.itemData })),
		},
	};

	return context;
}
