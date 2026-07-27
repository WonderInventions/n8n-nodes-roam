import type { IDataObject, ILoadOptionsFunctions, INodePropertyOptions } from 'n8n-workflow';

import { apiRequest } from './transport';

/**
 * Group picker, shared by the Roam and Roam Trigger nodes.
 *
 * `/v1/group.list` is the modern shape: `{ groups: [...], nextCursor }` where
 * `id` is the group's address UUID. The older `/v1/groups.list` returns a bare
 * array keyed on `addressId` and exists only for legacy callers; accept both so
 * a Roam still serving the legacy shape keeps working.
 */
export async function getGroups(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	// 100 is the server-side maximum page size; n8n dropdowns are not paginated.
	const response = (await apiRequest.call(this, 'GET', '/v1/group.list', {}, { limit: 100 })) as
		| IDataObject[]
		| IDataObject;

	const groups = Array.isArray(response)
		? response
		: (((response as IDataObject).groups as IDataObject[]) ?? []);

	return groups.map((group) => {
		// Both keys carry the same group address UUID, which is what
		// /v1/chat.post's `groupId` and /v1/chat.history's `groupId` expect.
		const id = (group.id ?? group.addressId) as string;
		return {
			name: (group.name as string) ?? id,
			value: id,
			description: (group.type ?? group.groupType) as string | undefined,
		};
	});
}
