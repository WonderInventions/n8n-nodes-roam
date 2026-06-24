import type { IExecuteFunctions, IDataObject, INodeExecutionData } from 'n8n-workflow';
import { apiRequest } from '../../transport';
import type { OnairGuestProperties } from '../../interfaces';

export const updateDescription: OnairGuestProperties = [
	{
		displayName: 'Guest ID',
		name: 'guestId',
		type: 'string',
		required: true,
		default: '',
		description: 'The identifier of the guest to update',
		displayOptions: {
			show: {
				operation: ['update'],
				resource: ['onairGuest'],
			},
		},
	},
	{
		displayName: 'RSVP Status',
		name: 'status',
		type: 'options',
		required: true,
		options: [
			{ name: 'Invited', value: 'invited' },
			{ name: 'Going', value: 'going' },
			{ name: 'Maybe', value: 'maybe' },
			{ name: 'Not Going', value: 'notGoing' },
		],
		default: 'going',
		description: 'New RSVP status for the guest',
		displayOptions: {
			show: {
				operation: ['update'],
				resource: ['onairGuest'],
			},
		},
	},
];

export async function update(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const guestId = this.getNodeParameter('guestId', index) as string;
	const status = this.getNodeParameter('status', index) as string;

	const body: IDataObject = {
		id: guestId,
		status,
	};

	const responseData = await apiRequest.call(this, 'POST', '/v1/onair.guest.update', body);

	const executionData = this.helpers.returnJsonArray(responseData as IDataObject[]);

	return this.helpers.constructExecutionMetaData(executionData, {
		itemData: { item: index },
	});
}
