import type { INodeProperties } from 'n8n-workflow';
import { listDescription } from './list';
import { infoDescription } from './info';
import { addDescription } from './add';
import { updateDescription } from './update';
import { removeDescription } from './remove';
import { listAttendanceDescription } from './listAttendance';

const showOnlyForOnairGuest = {
	resource: ['onairGuest'],
};

export const onairGuestDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: showOnlyForOnairGuest,
		},
		options: [
			{
				name: 'Add Guest',
				value: 'add',
				description: 'Add a guest to an event',
				action: 'Add a guest',
			},
			{
				name: 'Get Guest Info',
				value: 'info',
				description: 'Get details for a guest',
				action: 'Get guest info',
			},
			{
				name: 'List Attendance',
				value: 'listAttendance',
				description: 'Get attendance report for an event',
				action: 'List attendance',
			},
			{
				name: 'List Guests',
				value: 'list',
				description: 'List guests for an event',
				action: 'List guests',
			},
			{
				name: 'Remove Guest',
				value: 'remove',
				description: 'Remove a guest from an event',
				action: 'Remove a guest',
			},
			{
				name: 'Update RSVP',
				value: 'update',
				description: "Update a guest's RSVP status",
				action: 'Update guest RSVP',
			},
		],
		default: 'list',
	},
	...addDescription,
	...infoDescription,
	...listDescription,
	...listAttendanceDescription,
	...removeDescription,
	...updateDescription,
];

export { add } from './add';
export { info } from './info';
export { list } from './list';
export { listAttendance } from './listAttendance';
export { remove } from './remove';
export { update } from './update';
