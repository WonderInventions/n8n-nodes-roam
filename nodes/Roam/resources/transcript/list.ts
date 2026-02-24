import type { IExecuteFunctions, IDataObject, INodeExecutionData } from 'n8n-workflow';
import { apiRequest } from '../../transport';
import type { TranscriptProperties } from '../../interfaces';
import { DateTime } from 'luxon';

const convertToRFC3339 = (dateStr: string): string => {
	if (!dateStr) return '';
	const dateTime = DateTime.fromFormat(dateStr, `yyyy-MM-dd'T'HH:mm:ss`);
	return dateTime.toISO() || dateStr;
};

export const listDescription: TranscriptProperties = [
	{
		displayName: 'After',
		name: 'after',
		type: 'dateTime',
		default: '',
		description: 'Only return transcripts after this date',
		displayOptions: {
			show: {
				operation: ['list'],
				resource: ['transcript'],
			},
		},
	},
	{
		displayName: 'Before',
		name: 'before',
		type: 'dateTime',
		default: '',
		description: 'Only return transcripts before this date',
		displayOptions: {
			show: {
				operation: ['list'],
				resource: ['transcript'],
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
				resource: ['transcript'],
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
	const limit = this.getNodeParameter('limit', index, 10) as number;

	const qs: IDataObject = {};
	if (after) qs.after = convertToRFC3339(after);
	if (before) qs.before = convertToRFC3339(before);
	if (limit) qs.limit = limit;

	const responseData = await apiRequest.call(this, 'GET', '/v0/transcript.list', {}, qs);

	const transcripts = ((responseData as IDataObject).transcripts as IDataObject[]) ?? [];
	const executionData = this.helpers.returnJsonArray(transcripts);

	return this.helpers.constructExecutionMetaData(executionData, {
		itemData: {
			item: index,
		},
	});
}
