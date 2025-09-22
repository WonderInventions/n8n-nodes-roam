import type { AllEntities, Entity, PropertiesOf } from 'n8n-workflow';

export type RoamMap = {
	message: 'send';
	meeting: 'create';
};

export type Roam = AllEntities<RoamMap>;

export type RoamMessage = Entity<RoamMap, 'message'>;
export type RoamMeeting = Entity<RoamMap, 'meeting'>;

export type MessageProperties = PropertiesOf<RoamMessage>;
export type MeetingProperties = PropertiesOf<RoamMeeting>;
