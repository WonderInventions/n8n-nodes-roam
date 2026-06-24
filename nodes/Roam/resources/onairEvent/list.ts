import type { IExecuteFunctions, IDataObject, INodeExecutionData } from 'n8n-workflow';
import { apiRequest } from '../../transport';
import type { OnairEventProperties } from '../../interfaces';

export const listDescription: OnairEventProperties = [
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
				resource: ['onairEvent'],
			},
		},
	},
];

export async function list(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const limit = this.getNodeParameter('limit', index, 50) as number;

	const qs: IDataObject = {};
	if (limit) qs.limit = limit;

	const responseData = await apiRequest.call(this, 'GET', '/v1/onair.event.list', {}, qs);

	const events = ((responseData as IDataObject).events as IDataObject[]) ?? [];
	const executionData = this.helpers.returnJsonArray(events);

	return this.helpers.constructExecutionMetaData(executionData, {
		itemData: { item: index },
	});
}
