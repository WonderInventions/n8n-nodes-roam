import type { IExecuteFunctions, IDataObject, INodeExecutionData } from 'n8n-workflow';
import { apiRequest } from '../../transport';
import type { OnairEventProperties } from '../../interfaces';
import { DateTime } from 'luxon';

const convertToRFC3339 = (dateStr: string): string => {
	if (!dateStr) return '';
	const dateTime = DateTime.fromFormat(dateStr, `yyyy-MM-dd'T'HH:mm:ss`);
	return dateTime.toISO() || dateStr;
};

export const createDescription: OnairEventProperties = [
	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		required: true,
		default: '',
		description: 'The title of the event',
		displayOptions: {
			show: {
				operation: ['create'],
				resource: ['onairEvent'],
			},
		},
	},
	{
		displayName: 'Calendar Host Email',
		name: 'calendarHostEmail',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'host@example.com',
		description: 'Email of the calendar host (must be an org member)',
		displayOptions: {
			show: {
				operation: ['create'],
				resource: ['onairEvent'],
			},
		},
	},
	{
		displayName: 'Start Time',
		name: 'start',
		type: 'dateTime',
		required: true,
		default: '',
		description: 'Event start time',
		displayOptions: {
			show: {
				operation: ['create'],
				resource: ['onairEvent'],
			},
		},
	},
	{
		displayName: 'End Time',
		name: 'end',
		type: 'dateTime',
		required: true,
		default: '',
		description: 'Event end time',
		displayOptions: {
			show: {
				operation: ['create'],
				resource: ['onairEvent'],
			},
		},
	},
	{
		displayName: 'Time Zone',
		name: 'timeZone',
		type: 'string',
		required: true,
		default: 'America/New_York',
		placeholder: 'America/New_York',
		description: 'IANA time zone identifier',
		displayOptions: {
			show: {
				operation: ['create'],
				resource: ['onairEvent'],
			},
		},
	},
	{
		displayName: 'Description',
		name: 'description',
		type: 'string',
		default: '',
		description: 'Event description',
		displayOptions: {
			show: {
				operation: ['create'],
				resource: ['onairEvent'],
			},
		},
	},
	{
		displayName: 'Auto Admit',
		name: 'autoAdmit',
		type: 'boolean',
		default: true,
		description: 'Whether guests who RSVP\'d "going" are automatically admitted',
		displayOptions: {
			show: {
				operation: ['create'],
				resource: ['onairEvent'],
			},
		},
	},
	{
		displayName: 'Disable RSVP',
		name: 'disableRSVP',
		type: 'boolean',
		default: false,
		description: 'Whether the event page is view-only (no RSVP)',
		displayOptions: {
			show: {
				operation: ['create'],
				resource: ['onairEvent'],
			},
		},
	},
	{
		displayName: 'Enable SEO',
		name: 'enableSEO',
		type: 'boolean',
		default: false,
		description: 'Whether the event page is indexed by search engines',
		displayOptions: {
			show: {
				operation: ['create'],
				resource: ['onairEvent'],
			},
		},
	},
];

export async function create(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const title = this.getNodeParameter('title', index) as string;
	const calendarHostEmail = this.getNodeParameter('calendarHostEmail', index) as string;
	const start = this.getNodeParameter('start', index) as string;
	const end = this.getNodeParameter('end', index) as string;
	const timeZone = this.getNodeParameter('timeZone', index) as string;
	const description = this.getNodeParameter('description', index, '') as string;
	const autoAdmit = this.getNodeParameter('autoAdmit', index, true) as boolean;
	const disableRSVP = this.getNodeParameter('disableRSVP', index, false) as boolean;
	const enableSEO = this.getNodeParameter('enableSEO', index, false) as boolean;

	const body: IDataObject = {
		title,
		calendarHostEmail,
		start: convertToRFC3339(start),
		end: convertToRFC3339(end),
		timeZone,
		autoAdmit,
		disableRSVP,
		enableSEO,
	};

	if (description) body.description = description;

	const responseData = await apiRequest.call(this, 'POST', '/v1/onair.event.create', body);

	const executionData = this.helpers.returnJsonArray(responseData as IDataObject[]);

	return this.helpers.constructExecutionMetaData(executionData, {
		itemData: { item: index },
	});
}
