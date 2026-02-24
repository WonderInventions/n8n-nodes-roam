import type { IExecuteFunctions, IDataObject, INodeExecutionData } from 'n8n-workflow';
import { apiRequest } from '../../transport';
import type { TranscriptProperties } from '../../interfaces';

export const infoDescription: TranscriptProperties = [
	{
		displayName: 'Transcript ID',
		name: 'id',
		type: 'string',
		required: true,
		default: '',
		description: 'The UUID of the transcript to retrieve',
		placeholder: 'e.g. a1b2c3d4-e5f6-7890-abcd-ef1234567890',
		displayOptions: {
			show: {
				operation: ['info'],
				resource: ['transcript'],
			},
		},
	},
];

export async function info(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const id = this.getNodeParameter('id', index) as string;

	const responseData = await apiRequest.call(this, 'GET', '/v0/transcript.info', {}, { id });

	const executionData = this.helpers.returnJsonArray(responseData as IDataObject[]);

	return this.helpers.constructExecutionMetaData(executionData, {
		itemData: {
			item: index,
		},
	});
}
