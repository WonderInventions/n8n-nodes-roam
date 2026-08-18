import type { INodeProperties } from 'n8n-workflow';
import { sendDescription } from './send';

const showOnlyForMessages = {
	resource: ['message'],
};

export const messageDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: showOnlyForMessages,
		},
		options: [
			{
				name: 'Send Message',
				value: 'send',
				description: 'Send a message to a Roam group',
				action: 'Send a message',
			},
		],
		default: 'send',
	},
	...sendDescription,
];

export { send } from './send';
