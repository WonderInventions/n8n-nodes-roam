import type { IDataObject } from 'n8n-workflow';

export type V2EventConfig = {
	apiValue: string;
	filter?: IDataObject;
	listEndpoint: string;
	listProperty: string;
};

export const V2_EVENT_MAP: Record<string, V2EventConfig> = {
	recordingSaved: {
		apiValue: 'meeting.ended',
		filter: { hasVideo: true },
		listEndpoint: '/v1/meeting.list',
		listProperty: 'meetings',
	},
	transcriptSaved: {
		apiValue: 'meeting.ended',
		listEndpoint: '/v1/meeting.list',
		listProperty: 'meetings',
	},
	meetingEnded: {
		apiValue: 'meeting.ended',
		listEndpoint: '/v1/meeting.list',
		listProperty: 'meetings',
	},
	meetingStarted: {
		apiValue: 'meeting.started',
		listEndpoint: '/v1/meeting.list',
		listProperty: 'meetings',
	},
	chatMessage: {
		apiValue: 'chat.message',
		listEndpoint: '/v1/chat.list',
		listProperty: 'chats',
	},
};

/**
 * v1 currently dual-delivers one event as two POSTs with the same webhook-id:
 * a legacy tagged-id body (`type` is a short discriminator like `"message"`)
 * and a v1 envelope (`type` is the dotted event name, payload under `data`).
 * Prefer the envelope; return null so the trigger ignores the leftover.
 */
export function unwrapWebhookPayload(body: IDataObject): IDataObject | null {
	const data = body.data;
	const type = body.type;
	const isEnvelope =
		typeof type === 'string' &&
		type.includes('.') &&
		data !== undefined &&
		typeof data === 'object' &&
		!Array.isArray(data);

	if (isEnvelope) {
		return {
			...(data as IDataObject),
			eventType: type,
			eventId: body.eventId,
			apiVersion: body.apiVersion,
		};
	}

	if (typeof type === 'string' && !type.includes('.')) {
		return null;
	}

	return body;
}

export function buildWebhookSubscribeBody(params: {
	url: string;
	event: string;
	apiVersion: string;
	chatType?: string;
	mention?: boolean;
}): IDataObject {
	const mapped = V2_EVENT_MAP[params.event];
	const filter: IDataObject = { ...(mapped?.filter ?? {}) };
	if (params.event === 'chatMessage') {
		if (params.chatType) {
			filter.chatType = params.chatType;
		}
		if (params.mention) {
			filter.mention = true;
		}
	}

	const body: IDataObject = {
		url: params.url,
		event: mapped?.apiValue ?? params.event,
		apiVersion: params.apiVersion,
	};
	if (Object.keys(filter).length > 0) {
		body.filter = filter;
	}
	return body;
}
