import type { INodeProperties } from 'n8n-workflow';
import { createDescription } from './create';

const showOnlyForMeetings = {
	resource: ['meeting'],
};

export const meetingDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: showOnlyForMeetings,
		},
		options: [
			{
				name: 'Create Meeting Link',
				value: 'create',
				description: 'Create a meeting link',
				action: 'Create a meeting link',
			},
		],
		default: 'create',
	},
	...createDescription,
];

export { create } from './create';
