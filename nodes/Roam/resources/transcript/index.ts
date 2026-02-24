import type { INodeProperties } from 'n8n-workflow';
import { listDescription } from './list';
import { infoDescription } from './info';
import { promptDescription } from './prompt';

const showOnlyForTranscripts = {
	resource: ['transcript'],
};

export const transcriptDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: showOnlyForTranscripts,
		},
		options: [
			{
				name: 'Get Transcript Info',
				value: 'info',
				description: 'Get detailed information about a specific transcript',
				action: 'Get transcript info',
			},
			{
				name: 'List Transcripts',
				value: 'list',
				description: 'List transcripts with optional date filtering',
				action: 'List transcripts',
			},
			{
				name: 'Prompt Transcript',
				value: 'prompt',
				description: 'Ask a question about a transcript using AI',
				action: 'Prompt a transcript',
			},
		],
		default: 'list',
	},
	...infoDescription,
	...listDescription,
	...promptDescription,
];

export { list } from './list';
export { info } from './info';
export { prompt } from './prompt';
