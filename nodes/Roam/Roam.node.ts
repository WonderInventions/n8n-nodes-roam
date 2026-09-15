import type { INodeTypeBaseDescription, IVersionedNodeType } from 'n8n-workflow';
import { VersionedNodeType } from 'n8n-workflow';

import { RoamV1 } from './v1/RoamV1';
import { RoamV2 } from './v2/RoamV2';

export class Roam extends VersionedNodeType {
	constructor() {
		const baseDescription: INodeTypeBaseDescription = {
			displayName: 'Roam',
			name: 'roam',
			icon: { light: 'file:roam.svg', dark: 'file:roam.dark.svg' },
			group: ['transform'],
			description: 'Interact with Roam',
			defaultVersion: 2,
		};

		const nodeVersions: IVersionedNodeType['nodeVersions'] = {
			1: new RoamV1(baseDescription),
			2: new RoamV2(baseDescription),
		};

		super(nodeVersions, baseDescription);
	}
}
