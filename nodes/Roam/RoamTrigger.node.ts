import type { INodeTypeBaseDescription, IVersionedNodeType } from 'n8n-workflow';
import { VersionedNodeType } from 'n8n-workflow';

import { RoamTriggerV1 } from './v1/RoamTriggerV1';
import { RoamTriggerV2 } from './v2/RoamTriggerV2';

export class RoamTrigger extends VersionedNodeType {
	constructor() {
		const baseDescription: INodeTypeBaseDescription = {
			displayName: 'Roam Trigger',
			name: 'roamTrigger',
			icon: { light: 'file:roam.svg', dark: 'file:roam.dark.svg' },
			group: ['trigger'],
			description: 'Handle Roam webhooks',
			defaultVersion: 2,
		};

		const nodeVersions: IVersionedNodeType['nodeVersions'] = {
			1: new RoamTriggerV1(baseDescription),
			2: new RoamTriggerV2(baseDescription),
		};

		super(nodeVersions, baseDescription);
	}
}
