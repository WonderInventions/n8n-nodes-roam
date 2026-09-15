import type { IDataObject } from 'n8n-workflow';

import {
	apiRequest as apiRequestBase,
	apiRequestAllPages as apiRequestAllPagesBase,
	ROAM_API_VERSION_V2,
	type RoamRequestOptions,
} from '../transport';

export { toNodeApiError, extractRoamErrorCode } from '../transport';

export const ROAM_API_VERSION = ROAM_API_VERSION_V2;

type TransportThis = ThisParameterType<typeof apiRequestBase>;

export async function apiRequest(
	this: TransportThis,
	method: 'GET' | 'POST' | 'PUT' | 'DELETE',
	endpoint: string,
	body: IDataObject = {},
	qs: IDataObject = {},
	optionOverrides: RoamRequestOptions = {},
) {
	return apiRequestBase.call(this, method, endpoint, body, qs, {
		...optionOverrides,
		roamVersion: ROAM_API_VERSION_V2,
	});
}

export async function apiRequestAllPages(
	this: TransportThis,
	endpoint: string,
	listKey: string,
	qs: IDataObject = {},
): Promise<IDataObject[]> {
	return apiRequestAllPagesBase.call(this, endpoint, listKey, qs, ROAM_API_VERSION_V2);
}
