import type { IExecuteFunctions, IDataObject, INodeExecutionData } from 'n8n-workflow';
import { apiRequest } from '../../transport';
import type { OnairGuestProperties } from '../../interfaces';

export const listDescription: OnairGuestProperties = [
	{
		displayName: 'Event ID',
		name: 'eventId',
		type: 'string',
		required: true,
		default: '',
		description: 'The identifier of the event',
		displayOptions: {
			show: {
				operation: ['list'],
				resource: ['onairGuest'],
			},
		},
	},
	{
		displayName: 'Status Filter',
		name: 'status',
		type: 'options',
		options: [
			{ name: 'All', value: '' },
			{ name: 'Going', value: 'going' },
			{ name: 'Invited', value: 'invited' },
			{ name: 'Maybe', value: 'maybe' },
			{ name: 'Not Going', value: 'notGoing' },
		],
		default: '',
		description: 'Filter guests by RSVP status',
		displayOptions: {
			show: {
				operation: ['list'],
				resource: ['onairGuest'],
			},
		},
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		default: 50,
		description: 'Max number of results to return',
		typeOptions: {
			minValue: 1,
		},
		displayOptions: {
			show: {
				operation: ['list'],
				resource: ['onairGuest'],
			},
		},
	},
];

export async function list(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const eventId = this.getNodeParameter('eventId', index) as string;
	const status = this.getNodeParameter('status', index, '') as string;
	const limit = this.getNodeParameter('limit', index, 100) as number;

	const qs: IDataObject = { eventId };
	if (status) qs.status = status;
	if (limit) qs.limit = limit;

	const responseData = await apiRequest.call(this, 'GET', '/v1/onair.guest.list', {}, qs);

	const guests = ((responseData as IDataObject).guests as IDataObject[]) ?? [];
	const executionData = this.helpers.returnJsonArray(guests);

	return this.helpers.constructExecutionMetaData(executionData, {
		itemData: { item: index },
	});
}
