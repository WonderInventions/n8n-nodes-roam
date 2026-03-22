import type { IExecuteFunctions, IDataObject, INodeExecutionData } from 'n8n-workflow';
import { apiRequest } from '../../transport';
import type { OnairGuestProperties } from '../../interfaces';

export const addDescription: OnairGuestProperties = [
	{
		displayName: 'Event ID',
		name: 'eventId',
		type: 'string',
		required: true,
		default: '',
		description: 'The identifier of the event to add the guest to',
		displayOptions: {
			show: {
				operation: ['add'],
				resource: ['onairGuest'],
			},
		},
	},
	{
		displayName: 'Guest Email',
		name: 'email',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'guest@example.com',
		description: 'Email address of the guest',
		displayOptions: {
			show: {
				operation: ['add'],
				resource: ['onairGuest'],
			},
		},
	},
	{
		displayName: 'Guest Name',
		name: 'name',
		type: 'string',
		default: '',
		description: 'Name of the guest',
		displayOptions: {
			show: {
				operation: ['add'],
				resource: ['onairGuest'],
			},
		},
	},
	{
		displayName: 'Phone',
		name: 'phone',
		type: 'string',
		default: '',
		description: 'Phone number of the guest',
		displayOptions: {
			show: {
				operation: ['add'],
				resource: ['onairGuest'],
			},
		},
	},
	{
		displayName: 'RSVP Status',
		name: 'status',
		type: 'options',
		options: [
			{ name: 'Invited', value: 'invited' },
			{ name: 'Going', value: 'going' },
			{ name: 'Maybe', value: 'maybe' },
			{ name: 'Not Going', value: 'notGoing' },
		],
		default: 'invited',
		description: 'Initial RSVP status for the guest',
		displayOptions: {
			show: {
				operation: ['add'],
				resource: ['onairGuest'],
			},
		},
	},
];

export async function add(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const eventId = this.getNodeParameter('eventId', index) as string;
	const email = this.getNodeParameter('email', index) as string;
	const name = this.getNodeParameter('name', index, '') as string;
	const phone = this.getNodeParameter('phone', index, '') as string;
	const status = this.getNodeParameter('status', index, 'invited') as string;

	const guest: IDataObject = { email };
	if (name) guest.name = name;
	if (phone) guest.phone = phone;
	if (status) guest.status = status;

	const body: IDataObject = {
		eventId,
		guests: [guest],
	};

	const responseData = await apiRequest.call(this, 'POST', '/v1/onair.guest.add', body);

	const guests = ((responseData as IDataObject).guests as IDataObject[]) ?? [];
	const executionData = this.helpers.returnJsonArray(guests);

	return this.helpers.constructExecutionMetaData(executionData, {
		itemData: { item: index },
	});
}
