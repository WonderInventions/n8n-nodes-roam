import type { INodeProperties } from 'n8n-workflow';
import { listDescription } from './list';
import { infoDescription } from './info';
import { createDescription } from './create';
import { updateDescription } from './update';
import { cancelDescription } from './cancel';

const showOnlyForOnairEvent = {
	resource: ['onairEvent'],
};

export const onairEventDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: showOnlyForOnairEvent,
		},
		options: [
			{
				name: 'Cancel Event',
				value: 'cancel',
				description: 'Cancel an event',
				action: 'Cancel an event',
			},
			{
				name: 'Create Event',
				value: 'create',
				description: 'Create a new event',
				action: 'Create an event',
			},
			{
				name: 'Get Event Info',
				value: 'info',
				description: 'Get details for an event',
				action: 'Get event info',
			},
			{
				name: 'List Events',
				value: 'list',
				description: 'List events (most recent first)',
				action: 'List events',
			},
			{
				name: 'Update Event',
				value: 'update',
				description: 'Update an event',
				action: 'Update an event',
			},
		],
		default: 'list',
	},
	...cancelDescription,
	...createDescription,
	...infoDescription,
	...listDescription,
	...updateDescription,
];

export { cancel } from './cancel';
export { create } from './create';
export { info } from './info';
export { list } from './list';
export { update } from './update';
