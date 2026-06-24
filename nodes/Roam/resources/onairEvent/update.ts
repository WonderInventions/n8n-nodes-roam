import type { IExecuteFunctions, IDataObject, INodeExecutionData } from 'n8n-workflow';
import { apiRequest } from '../../transport';
import type { OnairEventProperties } from '../../interfaces';
import { DateTime } from 'luxon';

const convertToRFC3339 = (dateStr: string): string => {
	if (!dateStr) return '';
	const dateTime = DateTime.fromFormat(dateStr, `yyyy-MM-dd'T'HH:mm:ss`);
	return dateTime.toISO() || dateStr;
};

export const updateDescription: OnairEventProperties = [
	{
		displayName: 'Event ID',
		name: 'eventId',
		type: 'string',
		required: true,
		default: '',
		description: 'The identifier of the event to update',
		displayOptions: {
			show: {
				operation: ['update'],
				resource: ['onairEvent'],
			},
		},
	},
	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		default: '',
		description: 'New title for the event',
		displayOptions: {
			show: {
				operation: ['update'],
				resource: ['onairEvent'],
			},
		},
	},
	{
		displayName: 'Description',
		name: 'description',
		type: 'string',
		default: '',
		description: 'New description for the event',
		displayOptions: {
			show: {
				operation: ['update'],
				resource: ['onairEvent'],
			},
		},
	},
	{
		displayName: 'Calendar Host Email',
		name: 'calendarHostEmail',
		type: 'string',
		default: '',
		placeholder: 'host@example.com',
		description: 'New calendar host email',
		displayOptions: {
			show: {
				operation: ['update'],
				resource: ['onairEvent'],
			},
		},
	},
	{
		displayName: 'Start Time',
		name: 'start',
		type: 'dateTime',
		default: '',
		description: 'New start time',
		displayOptions: {
			show: {
				operation: ['update'],
				resource: ['onairEvent'],
			},
		},
	},
	{
		displayName: 'End Time',
		name: 'end',
		type: 'dateTime',
		default: '',
		description: 'New end time',
		displayOptions: {
			show: {
				operation: ['update'],
				resource: ['onairEvent'],
			},
		},
	},
	{
		displayName: 'Time Zone',
		name: 'timeZone',
		type: 'string',
		default: '',
		placeholder: 'America/New_York',
		description: 'New IANA time zone identifier',
		displayOptions: {
			show: {
				operation: ['update'],
				resource: ['onairEvent'],
			},
		},
	},
	{
		displayName: 'Auto Admit',
		name: 'autoAdmit',
		type: 'options',
		options: [
			{ name: 'No Change', value: '' },
			{ name: 'Yes', value: 'true' },
			{ name: 'No', value: 'false' },
		],
		default: '',
		description: 'Whether guests who RSVP\'d "going" are automatically admitted',
		displayOptions: {
			show: {
				operation: ['update'],
				resource: ['onairEvent'],
			},
		},
	},
	{
		displayName: 'Disable RSVP',
		name: 'disableRSVP',
		type: 'options',
		options: [
			{ name: 'No Change', value: '' },
			{ name: 'Yes', value: 'true' },
			{ name: 'No', value: 'false' },
		],
		default: '',
		description: 'Whether the event page is view-only',
		displayOptions: {
			show: {
				operation: ['update'],
				resource: ['onairEvent'],
			},
		},
	},
	{
		displayName: 'Enable SEO',
		name: 'enableSEO',
		type: 'options',
		options: [
			{ name: 'No Change', value: '' },
			{ name: 'Yes', value: 'true' },
			{ name: 'No', value: 'false' },
		],
		default: '',
		description: 'Whether the event page is indexed by search engines',
		displayOptions: {
			show: {
				operation: ['update'],
				resource: ['onairEvent'],
			},
		},
	},
];

export async function update(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const eventId = this.getNodeParameter('eventId', index) as string;

	const body: IDataObject = { id: eventId };

	const title = this.getNodeParameter('title', index, '') as string;
	if (title) body.title = title;

	const description = this.getNodeParameter('description', index, '') as string;
	if (description) body.description = description;

	const calendarHostEmail = this.getNodeParameter('calendarHostEmail', index, '') as string;
	if (calendarHostEmail) body.calendarHostEmail = calendarHostEmail;

	const start = this.getNodeParameter('start', index, '') as string;
	if (start) body.start = convertToRFC3339(start);

	const end = this.getNodeParameter('end', index, '') as string;
	if (end) body.end = convertToRFC3339(end);

	const timeZone = this.getNodeParameter('timeZone', index, '') as string;
	if (timeZone) body.timeZone = timeZone;

	const autoAdmit = this.getNodeParameter('autoAdmit', index, '') as string;
	if (autoAdmit) body.autoAdmit = autoAdmit === 'true';

	const disableRSVP = this.getNodeParameter('disableRSVP', index, '') as string;
	if (disableRSVP) body.disableRSVP = disableRSVP === 'true';

	const enableSEO = this.getNodeParameter('enableSEO', index, '') as string;
	if (enableSEO) body.enableSEO = enableSEO === 'true';

	const responseData = await apiRequest.call(this, 'POST', '/v1/onair.event.update', body);

	const executionData = this.helpers.returnJsonArray(responseData as IDataObject[]);

	return this.helpers.constructExecutionMetaData(executionData, {
		itemData: { item: index },
	});
}
