import type { IExecuteFunctions, IDataObject, INodeExecutionData } from 'n8n-workflow';
import { apiRequest } from '../../transport';
import type { OnairEventProperties } from '../../interfaces';

export const infoDescription: OnairEventProperties = [
	{
		displayName: 'Event ID',
		name: 'eventId',
		type: 'string',
		required: true,
		default: '',
		description: 'The identifier of the event',
		displayOptions: {
			show: {
				operation: ['info'],
				resource: ['onairEvent'],
			},
		},
	},
];

export async function info(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const eventId = this.getNodeParameter('eventId', index) as string;

	const responseData = await apiRequest.call(this, 'GET', '/v1/onair.event.info', {}, { id: eventId });

	const executionData = this.helpers.returnJsonArray(responseData as IDataObject[]);

	return this.helpers.constructExecutionMetaData(executionData, {
		itemData: { item: index },
	});
}
