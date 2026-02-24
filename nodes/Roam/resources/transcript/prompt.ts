import type { IExecuteFunctions, IDataObject, INodeExecutionData } from 'n8n-workflow';
import { apiRequest } from '../../transport';
import type { TranscriptProperties } from '../../interfaces';

export const promptDescription: TranscriptProperties = [
	{
		displayName: 'Transcript ID',
		name: 'id',
		type: 'string',
		required: true,
		default: '',
		description: 'The UUID of the transcript to query',
		placeholder: 'e.g. a1b2c3d4-e5f6-7890-abcd-ef1234567890',
		displayOptions: {
			show: {
				operation: ['prompt'],
				resource: ['transcript'],
			},
		},
	},
	{
		displayName: 'Prompt',
		name: 'prompt',
		type: 'string',
		required: true,
		default: '',
		description: 'The question or instruction to run against the transcript',
		typeOptions: {
			rows: 4,
		},
		displayOptions: {
			show: {
				operation: ['prompt'],
				resource: ['transcript'],
			},
		},
	},
];

export async function prompt(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const id = this.getNodeParameter('id', index) as string;
	const promptText = this.getNodeParameter('prompt', index) as string;

	const body: IDataObject = { id, prompt: promptText };

	const responseData = await apiRequest.call(
		this,
		'POST',
		'/v0/transcript.prompt',
		body,
		{},
		{ timeout: 60000 },
	);

	const executionData = this.helpers.returnJsonArray(responseData as IDataObject[]);

	return this.helpers.constructExecutionMetaData(executionData, {
		itemData: {
			item: index,
		},
	});
}
