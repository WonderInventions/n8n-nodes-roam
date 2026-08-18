import {
	NodeOperationError,
	type IDataObject,
	type IExecuteFunctions,
	type INodeExecutionData,
} from 'n8n-workflow';
import type { MessageProperties } from '../../interfaces';
import { apiRequest } from '../../transport';

const taggedIdPattern = /^[BUVGMSDPC]-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hexColorPattern = /^#[0-9a-f]{6}$/i;

// v1 destinations are plain UUIDs. Strip a leftover tagged prefix (G-/U-/…)
// so saved expressions from the v0 Block Kit path still resolve.
export const toPlainUuid = (id: string): string => {
	if (taggedIdPattern.test(id)) {
		return id.slice(2);
	}

	return id;
};

export function applyChatPostDestination(
	body: IDataObject,
	destinationType: string,
	id: string,
): IDataObject {
	const uuid = toPlainUuid(id);
	if (destinationType === 'chat') {
		body.chatId = uuid;
	} else if (destinationType === 'user') {
		body.userIds = [uuid];
	} else {
		body.groupId = uuid;
	}
	return body;
}

export const sendDescription: MessageProperties = [
	{
		displayName: 'Destination',
		name: 'destinationType',
		type: 'options',
		options: [
			{
				name: 'Group',
				value: 'group',
			},
			{
				name: 'Chat',
				value: 'chat',
			},
			{
				name: 'User (DM)',
				value: 'user',
			},
		],
		default: 'group',
		displayOptions: {
			show: {
				operation: ['send'],
				resource: ['message'],
			},
		},
	},
	{
		displayName: 'Group Name or ID',
		name: 'groupId',
		type: 'options',
		description:
			'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
		typeOptions: {
			loadOptionsMethod: 'getGroups',
		},
		required: true,
		default: '',
		displayOptions: {
			show: {
				operation: ['send'],
				resource: ['message'],
			},
			hide: {
				destinationType: ['chat', 'user'],
			},
		},
	},
	{
		displayName: 'Chat ID',
		name: 'chatId',
		type: 'string',
		required: true,
		default: '',
		description: 'Existing chat UUID (for example from a Chat Message trigger)',
		displayOptions: {
			show: {
				operation: ['send'],
				resource: ['message'],
				destinationType: ['chat'],
			},
		},
	},
	{
		displayName: 'User Name or ID',
		name: 'userId',
		type: 'options',
		description:
			'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
		typeOptions: {
			loadOptionsMethod: 'getUsers',
		},
		required: true,
		default: '',
		displayOptions: {
			show: {
				operation: ['send'],
				resource: ['message'],
				destinationType: ['user'],
			},
		},
	},
	{
		displayName: 'Bot Name',
		name: 'botName',
		type: 'string',
		default: 'n8n',
		displayOptions: {
			show: {
				operation: ['send'],
				resource: ['message'],
			},
		},
	},
	{
		displayName: 'Sender Image URL',
		name: 'senderImageUrl',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				operation: ['send'],
				resource: ['message'],
			},
		},
	},
	{
		displayName: 'Message Formatting',
		name: 'messageFormatting',
		type: 'options',
		options: [
			{
				name: 'Plain',
				value: 'plain',
			},
			{
				name: 'Markdown',
				value: 'markdown',
			},
			{
				name: 'Block Kit (Simple)',
				value: 'blocks_simple',
			},
			{
				name: 'Block Kit (JSON)',
				value: 'blocks_json',
			},
		],
		default: 'markdown',
		displayOptions: {
			show: {
				operation: ['send'],
				resource: ['message'],
			},
		},
	},
	{
		displayName: 'Text',
		name: 'text',
		type: 'string',
		required: true,
		default: '',
		typeOptions: {
			rows: 4,
		},
		displayOptions: {
			show: {
				operation: ['send'],
				resource: ['message'],
				messageFormatting: ['plain'],
			},
		},
	},
	{
		displayName: 'Markdown',
		name: 'text',
		type: 'string',
		required: true,
		default: '',
		typeOptions: {
			rows: 4,
		},
		displayOptions: {
			show: {
				operation: ['send'],
				resource: ['message'],
				messageFormatting: ['markdown'],
			},
		},
	},
	{
		displayName: 'Color',
		name: 'colorPreset',
		type: 'options',
		options: [
			{
				name: 'Custom Hex',
				value: 'custom',
			},
			{
				name: 'Danger',
				value: 'danger',
			},
			{
				name: 'Good',
				value: 'good',
			},
			{
				name: 'None',
				value: '',
			},
			{
				name: 'Warning',
				value: 'warning',
			},
		],
		default: '',
		displayOptions: {
			show: {
				operation: ['send'],
				resource: ['message'],
				messageFormatting: ['blocks_simple', 'blocks_json'],
			},
		},
	},
	{
		displayName: 'Custom Hex',
		name: 'customHex',
		type: 'string',
		default: '',
		placeholder: '#00FF00',
		displayOptions: {
			show: {
				operation: ['send'],
				resource: ['message'],
				messageFormatting: ['blocks_simple', 'blocks_json'],
				colorPreset: ['custom'],
			},
		},
	},
	{
		displayName: 'Header',
		name: 'headerText',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				operation: ['send'],
				resource: ['message'],
				messageFormatting: ['blocks_simple'],
			},
		},
	},
	{
		displayName: 'Body',
		name: 'bodyText',
		type: 'string',
		required: true,
		default: '',
		typeOptions: {
			rows: 4,
		},
		displayOptions: {
			show: {
				operation: ['send'],
				resource: ['message'],
				messageFormatting: ['blocks_simple'],
			},
		},
	},
	{
		displayName: 'Body Format',
		name: 'bodyFormat',
		type: 'options',
		options: [
			{
				name: 'Markdown',
				value: 'mrkdwn',
			},
			{
				name: 'Plain Text',
				value: 'plain_text',
			},
		],
		default: 'mrkdwn',
		displayOptions: {
			show: {
				operation: ['send'],
				resource: ['message'],
				messageFormatting: ['blocks_simple'],
			},
		},
	},
	{
		displayName: 'Context',
		name: 'contextText',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				operation: ['send'],
				resource: ['message'],
				messageFormatting: ['blocks_simple'],
			},
		},
	},
	{
		displayName: 'Actions',
		name: 'actions',
		type: 'collection',
		default: {},
		placeholder: 'Configure actions',
		description: 'Optional URL buttons rendered in a separate actions block',
		options: [
			{
				displayName: 'Button 1 Label',
				name: 'button1Label',
				type: 'string',
				default: '',
			},
			{
				displayName: 'Button 1 URL',
				name: 'button1Url',
				type: 'string',
				default: '',
			},
			{
				displayName: 'Button 2 Label',
				name: 'button2Label',
				type: 'string',
				default: '',
			},
			{
				displayName: 'Button 2 URL',
				name: 'button2Url',
				type: 'string',
				default: '',
			},
		],
		displayOptions: {
			show: {
				operation: ['send'],
				resource: ['message'],
				messageFormatting: ['blocks_simple'],
			},
		},
	},
	{
		displayName: 'Blocks JSON (Array)',
		name: 'blocksJson',
		type: 'string',
		required: true,
		default: '',
		typeOptions: {
			rows: 8,
		},
		displayOptions: {
			show: {
				operation: ['send'],
				resource: ['message'],
				messageFormatting: ['blocks_json'],
			},
		},
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				operation: ['send'],
				resource: ['message'],
			},
		},
		options: [
			{
				displayName: 'Thread Timestamp',
				name: 'threadTimestamp',
				type: 'number',
				default: 0,
				description: 'Parent message timestamp (unix microseconds) to reply in a thread',
			},
			{
				displayName: 'Thread Key',
				name: 'threadKey',
				type: 'string',
				default: '',
				description: 'Stable key that creates or reuses a thread in a group chat (max 64 characters)',
			},
			{
				displayName: 'Reply Timestamp',
				name: 'replyTimestamp',
				type: 'number',
				default: 0,
				description: 'Timestamp of the message being replied to (DMs or in-thread only)',
			},
		],
	},
];

export async function send(this: IExecuteFunctions, index: number): Promise<INodeExecutionData[]> {
	const messageFormatting = this.getNodeParameter('messageFormatting', index, 'markdown') as string;
	const botName = this.getNodeParameter('botName', index) as string;
	const senderImageUrl = this.getNodeParameter('senderImageUrl', index) as string;
	const destinationType = this.getNodeParameter('destinationType', index, 'group') as string;
	const additionalFields = this.getNodeParameter('additionalFields', index, {}) as IDataObject;

	const sender: IDataObject = {
		id: '_',
		name: botName,
		imageUrl: senderImageUrl,
	};

	const body: IDataObject = {
		sender,
		sync: true,
	};

	const destinationId =
		destinationType === 'chat'
			? (this.getNodeParameter('chatId', index) as string)
			: destinationType === 'user'
				? (this.getNodeParameter('userId', index) as string)
				: (this.getNodeParameter('groupId', index) as string);
	applyChatPostDestination(body, destinationType, destinationId);

	if (messageFormatting === 'blocks_simple' || messageFormatting === 'blocks_json') {
		let blocks: IDataObject[];
		if (messageFormatting === 'blocks_simple') {
			const headerText = this.getNodeParameter('headerText', index, '') as string;
			const bodyText = this.getNodeParameter('bodyText', index) as string;
			const bodyFormat = this.getNodeParameter('bodyFormat', index, 'mrkdwn') as string;
			const contextText = this.getNodeParameter('contextText', index, '') as string;
			const actions = this.getNodeParameter('actions', index, {}) as IDataObject;
			const button1Label = (actions.button1Label as string | undefined) ?? '';
			const button1Url = (actions.button1Url as string | undefined) ?? '';
			const button2Label = (actions.button2Label as string | undefined) ?? '';
			const button2Url = (actions.button2Url as string | undefined) ?? '';

			const sectionBlock: IDataObject = {
				type: 'section',
				text: {
					type: bodyFormat,
					text: bodyText,
				} as IDataObject,
			};

			const actionButtons: IDataObject[] = [];
			const addButton = (label: string, url: string, buttonNumber: number) => {
				if (!label && !url) {
					return;
				}
				if (!label || !url) {
					throw new NodeOperationError(
						this.getNode(),
						`Button ${buttonNumber} requires both label and URL`,
						{
							itemIndex: index,
						}
					);
				}

				actionButtons.push({
					type: 'button',
					text: {
						type: 'plain_text',
						text: label,
					} as IDataObject,
					url,
				});
			};

			addButton(button1Label, button1Url, 1);
			addButton(button2Label, button2Url, 2);

			blocks = [];
			if (headerText) {
				blocks.push({
					type: 'header',
					text: {
						type: 'plain_text',
						text: headerText,
					} as IDataObject,
				});
			}

			blocks.push(sectionBlock);

			if (contextText) {
				blocks.push({
					type: 'context',
					elements: [
						{
							type: 'mrkdwn',
							text: contextText,
						},
					],
				});
			}

			if (actionButtons.length > 0) {
				blocks.push({
					type: 'actions',
					elements: actionButtons,
				});
			}
		} else {
			const blocksJson = this.getNodeParameter('blocksJson', index) as string;

			let parsed: unknown;
			try {
				parsed = JSON.parse(blocksJson);
			} catch {
				throw new NodeOperationError(this.getNode(), 'Blocks JSON must be valid JSON', {
					itemIndex: index,
				});
			}

			if (!Array.isArray(parsed)) {
				throw new NodeOperationError(this.getNode(), 'Blocks JSON must be a JSON array of blocks', {
					itemIndex: index,
				});
			}

			blocks = parsed as IDataObject[];
		}

		const colorPreset = this.getNodeParameter('colorPreset', index, '') as string;
		let color = colorPreset;
		if (colorPreset === 'custom') {
			const customHex = (this.getNodeParameter('customHex', index, '') as string).trim();
			if (!hexColorPattern.test(customHex)) {
				throw new NodeOperationError(
					this.getNode(),
					'Custom hex must match #RRGGBB (for example #00FF00)',
					{
						itemIndex: index,
					}
				);
			}
			color = customHex;
		}

		body.blocks = blocks;
		if (color) {
			body.color = color;
		}
	} else {
		body.text = this.getNodeParameter('text', index) as string;
		body.markdown = messageFormatting === 'markdown';
	}

	const threadTimestamp = additionalFields.threadTimestamp as number | undefined;
	if (threadTimestamp) {
		body.threadTimestamp = threadTimestamp;
	}
	const threadKey = additionalFields.threadKey as string | undefined;
	if (threadKey) {
		body.threadKey = threadKey;
	}
	const replyTimestamp = additionalFields.replyTimestamp as number | undefined;
	if (replyTimestamp) {
		body.replyTimestamp = replyTimestamp;
	}

	const responseData = await apiRequest.call(this, 'POST', '/v1/chat.post', body);

	const executionData = this.helpers.returnJsonArray(responseData as IDataObject[]);

	return this.helpers.constructExecutionMetaData(executionData, {
		itemData: {
			item: index,
		},
	});
}
