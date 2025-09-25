import type { IExecuteFunctions, IDataObject, INodeExecutionData } from 'n8n-workflow';
import { apiRequest } from '../../transport';
import type { MeetingProperties } from '../../interfaces';
import { DateTime } from 'luxon';

// Convert n8n datetime (2025-09-19T20:00:00) to RFC3339 using Luxon's default timezone
const convertToRFC3339 = (dateStr: string): string => {
	if (!dateStr) return '';
	const dateTime = DateTime.fromFormat(dateStr, `yyyy-MM-dd'T'HH:mm:ss`);
	return dateTime.toISO() || dateStr;
};

export const createDescription: MeetingProperties = [
	{
		displayName: 'Meeting Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				operation: ['create'],
				resource: ['meeting'],
			},
		},
	},
	{
		displayName: 'Host Email',
		name: 'host',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				operation: ['create'],
				resource: ['meeting'],
			},
		},
	},
	{
		displayName: 'Start Time',
		name: 'start',
		type: 'dateTime',
		required: true,
		default: '',
		displayOptions: {
			show: {
				operation: ['create'],
				resource: ['meeting'],
			},
		},
	},
	{
		displayName: 'End Time',
		name: 'end',
		type: 'dateTime',
		required: true,
		default: '',
		displayOptions: {
			show: {
				operation: ['create'],
				resource: ['meeting'],
			},
		},
	},
];

export async function create(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const name = this.getNodeParameter('name', index) as string;
	const host = this.getNodeParameter('host', index) as string;
	const start = this.getNodeParameter('start', index) as string;
	const end = this.getNodeParameter('end', index) as string;

	const body: IDataObject = {
		name,
		host,
		start: convertToRFC3339(start),
		end: convertToRFC3339(end),
	};

	const responseData = await apiRequest.call(this, 'POST', '/v0/meetinglink.create', body);

	return this.helpers.returnJsonArray(responseData as IDataObject[]);
}
