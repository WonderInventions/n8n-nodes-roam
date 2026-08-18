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

export function unwrapWebhookPayload(body: IDataObject): IDataObject {
	const data = body.data;
	if (data && typeof data === 'object' && !Array.isArray(data)) {
		return {
			...(data as IDataObject),
			eventType: body.type,
			eventId: body.eventId,
			apiVersion: body.apiVersion,
		};
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
