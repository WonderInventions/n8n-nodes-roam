import type { IExecuteFunctions, IDataObject, INodeExecutionData } from 'n8n-workflow';
import { apiRequest } from '../../transport';
import type { OnairGuestProperties } from '../../interfaces';

export const infoDescription: OnairGuestProperties = [
	{
		displayName: 'Guest ID',
		name: 'guestId',
		type: 'string',
		required: true,
		default: '',
		description: 'The identifier of the guest',
		displayOptions: {
			show: {
				operation: ['info'],
				resource: ['onairGuest'],
			},
		},
	},
];

export async function info(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const guestId = this.getNodeParameter('guestId', index) as string;

	const responseData = await apiRequest.call(this, 'GET', '/v1/onair.guest.info', {}, { id: guestId });

	const executionData = this.helpers.returnJsonArray(responseData as IDataObject[]);

	return this.helpers.constructExecutionMetaData(executionData, {
		itemData: { item: index },
	});
}
