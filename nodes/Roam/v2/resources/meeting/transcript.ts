import type { IExecuteFunctions, IDataObject, INodeExecutionData } from 'n8n-workflow';
import { apiRequest } from '../../transport';
import type { MeetingProperties } from '../../interfaces';

export const transcriptDescription: MeetingProperties = [
	{
		displayName: 'Meeting ID',
		name: 'id',
		type: 'string',
		required: true,
		default: '',
		description: 'The UUID of the meeting whose transcript to retrieve',
		placeholder: 'e.g. a1b2c3d4-e5f6-7890-abcd-ef1234567890',
		displayOptions: {
			show: {
				operation: ['transcript'],
				resource: ['meeting'],
			},
		},
	},
];

export async function transcript(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const id = this.getNodeParameter('id', index) as string;

	const responseData = await apiRequest.call(this, 'GET', '/v1/meeting.transcript', {}, { id });

	const executionData = this.helpers.returnJsonArray(responseData as IDataObject[]);

	return this.helpers.constructExecutionMetaData(executionData, {
		itemData: {
			item: index,
		},
	});
}
