import type { AllEntities, Entity, PropertiesOf } from 'n8n-workflow';

export type RoamMap = {
	message: 'send';
	meeting: 'create';
	transcript: 'list' | 'info' | 'prompt';
	onairEvent: 'list' | 'info' | 'create' | 'update' | 'cancel';
	onairGuest: 'list' | 'info' | 'add' | 'update' | 'remove';
	onairAttendance: 'list';
};

export type Roam = AllEntities<RoamMap>;

export type RoamMessage = Entity<RoamMap, 'message'>;
export type RoamMeeting = Entity<RoamMap, 'meeting'>;
export type RoamTranscript = Entity<RoamMap, 'transcript'>;
export type RoamOnairEvent = Entity<RoamMap, 'onairEvent'>;
export type RoamOnairGuest = Entity<RoamMap, 'onairGuest'>;
export type RoamOnairAttendance = Entity<RoamMap, 'onairAttendance'>;

export type MessageProperties = PropertiesOf<RoamMessage>;
export type MeetingProperties = PropertiesOf<RoamMeeting>;
export type TranscriptProperties = PropertiesOf<RoamTranscript>;
export type OnairEventProperties = PropertiesOf<RoamOnairEvent>;
export type OnairGuestProperties = PropertiesOf<RoamOnairGuest>;
export type OnairAttendanceProperties = PropertiesOf<RoamOnairAttendance>;
