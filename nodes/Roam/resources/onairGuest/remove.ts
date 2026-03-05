import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { apiRequest } from '../../transport';
import type { OnairGuestProperties } from '../../interfaces';

export const removeDescription: OnairGuestProperties = [
	{
		displayName: 'Guest ID',
		name: 'guestId',
		type: 'string',
		required: true,
		default: '',
		description: 'The identifier of the guest to remove',
		displayOptions: {
			show: {
				operation: ['remove'],
				resource: ['onairGuest'],
			},
		},
	},
];

export async function remove(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const guestId = this.getNodeParameter('guestId', index) as string;

	await apiRequest.call(this, 'POST', '/v1/onair.guest.remove', { id: guestId });

	const executionData = this.helpers.returnJsonArray([{ success: true }]);

	return this.helpers.constructExecutionMetaData(executionData, {
		itemData: { item: index },
	});
}
