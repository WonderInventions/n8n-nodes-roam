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
		description:
			'The UUID of the meeting whose transcript to retrieve. Get one from List Meetings, or from the meeting.ended event on the Roam Trigger node.',
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

	// v1 splits the old /v0/transcript.info response: cues live on
	// meeting.transcript, and the metadata/summary/action items live on
	// meeting.info. Returning only the cues here keeps one operation to one
	// request; use List Meetings with Include=Summary/Action Items for the rest.
	const responseData = await apiRequest.call(this, 'GET', '/v1/meeting.transcript', {}, { id });

	const executionData = this.helpers.returnJsonArray(responseData as IDataObject[]);

	return this.helpers.constructExecutionMetaData(executionData, {
		itemData: {
			item: index,
		},
	});
}
