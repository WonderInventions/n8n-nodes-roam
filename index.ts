import type { ICredentialType, INodeType } from 'n8n-workflow';

import { RoamApi } from './credentials/RoamApi.credentials';
import { Roam } from './nodes/Roam/Roam.node';
import { RoamTrigger } from './nodes/Roam/RoamTrigger.node';

export const credentials: ICredentialType[] = [new RoamApi()];
export const nodes: INodeType[] = [new Roam(), new RoamTrigger()];
