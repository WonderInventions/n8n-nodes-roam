import type { IExecuteFunctions, IDataObject, INodeExecutionData } from 'n8n-workflow';
import { apiRequest } from '../../transport';
import type { OnairGuestProperties } from '../../interfaces';

export const listAttendanceDescription: OnairGuestProperties = [
	{
		displayName: 'Event ID',
		name: 'eventId',
		type: 'string',
		required: true,
		default: '',
		description: 'The identifier of the event',
		displayOptions: {
			show: {
				operation: ['listAttendance'],
				resource: ['onairGuest'],
			},
		},
	},
];

export async function listAttendance(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const eventId = this.getNodeParameter('eventId', index) as string;

	const responseData = await apiRequest.call(this, 'GET', '/v1/onair.attendance.list', {}, { eventId });

	const attendees = ((responseData as IDataObject).attendees as IDataObject[]) ?? [];
	const executionData = this.helpers.returnJsonArray(attendees);

	return this.helpers.constructExecutionMetaData(executionData, {
		itemData: { item: index },
	});
}
