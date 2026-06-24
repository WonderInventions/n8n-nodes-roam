import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { apiRequest } from '../../transport';
import type { OnairEventProperties } from '../../interfaces';

export const cancelDescription: OnairEventProperties = [
	{
		displayName: 'Event ID',
		name: 'eventId',
		type: 'string',
		required: true,
		default: '',
		description: 'The identifier of the event to cancel',
		displayOptions: {
			show: {
				operation: ['cancel'],
				resource: ['onairEvent'],
			},
		},
	},
];

export async function cancel(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const eventId = this.getNodeParameter('eventId', index) as string;

	await apiRequest.call(this, 'POST', '/v1/onair.event.cancel', { id: eventId });

	const executionData = this.helpers.returnJsonArray([{ success: true }]);

	return this.helpers.constructExecutionMetaData(executionData, {
		itemData: { item: index },
	});
}
