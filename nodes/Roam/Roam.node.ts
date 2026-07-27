import type {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  JsonObject,
} from "n8n-workflow";

import { NodeApiError, NodeConnectionTypes, NodeOperationError } from "n8n-workflow";

import * as meeting from "./resources/meeting";
import * as message from "./resources/message";

import type { Roam as RoamType } from "./interfaces";
import { getGroups } from "./loadOptions";

type RoamEntity = RoamType;

const loadOptions = { getGroups };

export class Roam implements INodeType {
  description: INodeTypeDescription = {
    name: "roam",
    displayName: "Roam",
    description: "Interact with Roam",
    group: ["transform"],
    icon: { light: "file:roam.svg", dark: "file:roam.dark.svg" },
    usableAsTool: true,
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    credentials: [
      {
        name: "roamApi",
        required: true,
      },
    ],
    defaults: {
      name: "Roam",
    },
    properties: [
      {
        displayName: "Resource",
        name: "resource",
        type: "options",
        noDataExpression: true,
        options: [
          {
            name: "Meeting",
            value: "meeting",
          },
          {
            name: "Message",
            value: "message",
          },
        ],
        default: "message",
      },
      ...message.messageDescription,
      ...meeting.meetingDescription,
    ],
    subtitle: '={{$parameter["resource"] + ": " + $parameter["operation"]}}',
    version: 1,
  };

  methods = {
    loadOptions,
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const operationResult: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      const resource = this.getNodeParameter<RoamEntity>("resource", i);
      const operation = this.getNodeParameter("operation", i);

      const roam = {
        resource,
        operation,
      } as RoamEntity;

      try {
        if ((resource as string) === "transcript") {
          // 0.2.0 removed the standalone Transcript resource: v1 keys
          // transcripts, summaries, and prompts on the meeting, not on a
          // separate transcript id. Fail loudly with the migration rather than
          // silently emitting nothing, which is what the old fall-through did.
          throw new NodeOperationError(
            this.getNode(),
            'The "Transcript" resource was removed in n8n-nodes-roam 0.2.0',
            {
              itemIndex: i,
              description:
                'Use the "Meeting" resource instead: List Transcripts -> List Meetings, Get Transcript Info -> Get Transcript, Prompt Transcript -> Prompt Meeting. These operations take a meeting ID (from List Meetings or the Meeting Ended trigger), not a v0 transcript ID.',
            },
          );
        }

        if (roam.resource === "message") {
          if (roam.operation === "send") {
            operationResult.push(...(await message.send.call(this, i)));
          }
        } else if (roam.resource === "meeting") {
          if (roam.operation === "create") {
            operationResult.push(...(await meeting.create.call(this, i)));
          } else if (roam.operation === "list") {
            operationResult.push(...(await meeting.list.call(this, i)));
          } else if (roam.operation === "transcript") {
            operationResult.push(...(await meeting.transcript.call(this, i)));
          } else if (roam.operation === "prompt") {
            operationResult.push(...(await meeting.prompt.call(this, i)));
          }
        }
      } catch (err) {
        // transport.toNodeApiError already maps Roam codes (token_revoked, transcript_*, …),
        // and NodeOperationError carries our own migration/validation guidance.
        // Preserve both rather than re-wrapping and losing the message.
        const apiError =
          err instanceof NodeApiError || err instanceof NodeOperationError
            ? err
            : new NodeApiError(this.getNode(), err as JsonObject, { itemIndex: i });
        if (this.continueOnFail()) {
          operationResult.push({
            json: this.getInputData(i)[0].json,
            error: apiError,
            pairedItem: i,
          });
          continue;
        }
        throw apiError;
      }
    }

    return [operationResult];
  }
}
