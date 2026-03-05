import type { INodeProperties } from 'n8n-workflow';
import { listDescription } from './list';

const showOnlyForOnairAttendance = {
	resource: ['onairAttendance'],
};

export const onairAttendanceDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: showOnlyForOnairAttendance,
		},
		options: [
			{
				name: 'List Attendance',
				value: 'list',
				description: 'Get attendance report for an event',
				action: 'List attendance',
			},
		],
		default: 'list',
	},
	...listDescription,
];

export { list } from './list';
