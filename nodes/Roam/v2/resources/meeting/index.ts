import type { INodeProperties } from 'n8n-workflow';
import { createDescription } from './create';
import { listDescription } from './list';
import { infoDescription } from './info';
import { transcriptDescription } from './transcript';
import { promptDescription } from './prompt';

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
			{
				name: 'Get Meeting',
				value: 'info',
				description: 'Get details for a meeting',
				action: 'Get a meeting',
			},
			{
				name: 'Get Transcript',
				value: 'transcript',
				description: 'Get the transcript cues for a meeting',
				action: 'Get a meeting transcript',
			},
			{
				name: 'List Meetings',
				value: 'list',
				description: 'List meetings with optional date filtering',
				action: 'List meetings',
			},
			{
				name: 'Prompt Meeting',
				value: 'prompt',
				description: 'Ask a question about a meeting transcript using AI',
				action: 'Prompt a meeting',
			},
		],
		default: 'create',
	},
	...createDescription,
	...listDescription,
	...infoDescription,
	...transcriptDescription,
	...promptDescription,
];

export { create } from './create';
export { list } from './list';
export { info } from './info';
export { transcript } from './transcript';
export { prompt } from './prompt';
