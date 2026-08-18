import type { IExecuteFunctions, IDataObject, INodeExecutionData } from 'n8n-workflow';
import { apiRequest } from '../../transport';
import type { MeetingProperties } from '../../interfaces';
import { DateTime } from 'luxon';

const convertToRFC3339 = (dateStr: string): string => {
	if (!dateStr) return '';
	const dateTime = DateTime.fromFormat(dateStr, `yyyy-MM-dd'T'HH:mm:ss`);
	return dateTime.toISO() || dateStr;
};

export const listDescription: MeetingProperties = [
	{
		displayName: 'After',
		name: 'after',
		type: 'dateTime',
		default: '',
		description: 'Only return meetings after this date',
		displayOptions: {
			show: {
				operation: ['list'],
				resource: ['meeting'],
			},
		},
	},
	{
		displayName: 'Before',
		name: 'before',
		type: 'dateTime',
		default: '',
		description: 'Only return meetings before this date',
		displayOptions: {
			show: {
				operation: ['list'],
				resource: ['meeting'],
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
			maxValue: 100,
		},
		displayOptions: {
			show: {
				operation: ['list'],
				resource: ['meeting'],
			},
		},
	},
	{
		displayName: 'Cursor',
		name: 'cursor',
		type: 'string',
		default: '',
		description: 'Opaque cursor from a previous list response to fetch the next page',
		displayOptions: {
			show: {
				operation: ['list'],
				resource: ['meeting'],
			},
		},
	},
	{
		displayName: 'Expand',
		name: 'expand',
		type: 'multiOptions',
		options: [
			{
				name: 'Action Items',
				value: 'actionItems',
			},
			{
				name: 'Chapters',
				value: 'chapters',
			},
			{
				name: 'Summary',
				value: 'summary',
			},
		],
		default: [],
		description:
			'Include extra meeting content. Expanding caps the page size at 10.',
		displayOptions: {
			show: {
				operation: ['list'],
				resource: ['meeting'],
			},
		},
	},
];

export async function list(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const after = this.getNodeParameter('after', index, '') as string;
	const before = this.getNodeParameter('before', index, '') as string;
	const limit = this.getNodeParameter('limit', index, 50) as number;
	const cursor = this.getNodeParameter('cursor', index, '') as string;
	const expand = this.getNodeParameter('expand', index, []) as string[];

	const qs: IDataObject = {};
	if (after) qs.after = convertToRFC3339(after);
	if (before) qs.before = convertToRFC3339(before);
	if (limit) qs.limit = limit;
	if (cursor) qs.cursor = cursor;
	if (expand.length > 0) qs.expand = expand.join(',');

	const responseData = await apiRequest.call(this, 'GET', '/v1/meeting.list', {}, qs);

	const meetings = ((responseData as IDataObject).meetings as IDataObject[]) ?? [];
	const executionData = this.helpers.returnJsonArray(meetings);

	return this.helpers.constructExecutionMetaData(executionData, {
		itemData: {
			item: index,
		},
	});
}
