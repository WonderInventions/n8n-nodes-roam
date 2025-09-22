import type { ICredentialType, INodeType } from 'n8n-workflow';

import { RoamOAuth2Api } from './credentials/RoamOAuth2Api.credentials';
import { Roam } from './nodes/Roam/Roam.node';
import { RoamTrigger } from './nodes/Roam/RoamTrigger.node';

export const credentials: ICredentialType[] = [new RoamOAuth2Api()];
export const nodes: INodeType[] = [new Roam(), new RoamTrigger()];
