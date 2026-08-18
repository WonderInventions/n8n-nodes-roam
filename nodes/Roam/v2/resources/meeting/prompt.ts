import type { IExecuteFunctions, IDataObject, INodeExecutionData } from 'n8n-workflow';
import { apiRequest } from '../../transport';
import type { MeetingProperties } from '../../interfaces';

export const promptDescription: MeetingProperties = [
	{
		displayName: 'Meeting ID',
		name: 'id',
		type: 'string',
		required: true,
		default: '',
		description: 'The UUID of the meeting to query',
		placeholder: 'e.g. a1b2c3d4-e5f6-7890-abcd-ef1234567890',
		displayOptions: {
			show: {
				operation: ['prompt'],
				resource: ['meeting'],
			},
		},
	},
	{
		displayName: 'Prompt',
		name: 'prompt',
		type: 'string',
		required: true,
		default: '',
		description: 'The question or instruction to run against the meeting transcript',
		typeOptions: {
			rows: 4,
		},
		displayOptions: {
			show: {
				operation: ['prompt'],
				resource: ['meeting'],
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
		'/v1/meeting.prompt',
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
