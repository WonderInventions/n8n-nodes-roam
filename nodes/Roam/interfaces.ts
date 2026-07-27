import type { AllEntities, Entity, PropertiesOf } from 'n8n-workflow';

export type RoamMap = {
	message: 'send';
	// v1 keys transcripts, summaries, and prompts on the *meeting*, not on a
	// standalone transcript id, so the former `transcript` resource folded into
	// this one in 0.2.0.
	meeting: 'create' | 'list' | 'transcript' | 'prompt';
};

export type Roam = AllEntities<RoamMap>;

export type RoamMessage = Entity<RoamMap, 'message'>;
export type RoamMeeting = Entity<RoamMap, 'meeting'>;

export type MessageProperties = PropertiesOf<RoamMessage>;
export type MeetingProperties = PropertiesOf<RoamMeeting>;
