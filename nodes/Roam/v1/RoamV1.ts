import type {
  IDataObject,
  IExecuteFunctions,
  ILoadOptionsFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeBaseDescription,
  INodeTypeDescription,
  JsonObject,
} from "n8n-workflow";

import { NodeApiError, NodeConnectionTypes } from "n8n-workflow";

import * as meeting from "./resources/meeting";
import * as message from "./resources/message";
import * as transcript from "./resources/transcript";

import type { Roam as RoamType } from "./interfaces";
import { apiRequest } from "../transport";

type RoamEntity = RoamType;

const loadOptions = {
  async getGroups(this: ILoadOptionsFunctions): Promise<Array<{ name: string; value: string }>> {
    // v1 success bodies include `"ok": true` alongside the list field; ignore `ok`.
    const response = (await apiRequest.call(this, "GET", "/v1/groups.list")) as
      | IDataObject[]
      | IDataObject;

    const groups = Array.isArray(response)
      ? response
      : (((response as IDataObject).groups as IDataObject[]) ?? []);

    return groups.map((group) => ({
      name: (group.name as string) ?? (group.addressId as string),
      value: group.addressId as string,
      description: group.groupType as string | undefined,
    }));
  },
};

export class RoamV1 implements INodeType {
  description: INodeTypeDescription;

  constructor(baseDescription: INodeTypeBaseDescription) {
    this.description = {
      ...baseDescription,
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
            {
              name: "Transcript",
              value: "transcript",
            },
          ],
          default: "message",
        },
        ...message.messageDescription,
        ...meeting.meetingDescription,
        ...transcript.transcriptDescription,
      ],
      subtitle: '={{$parameter["resource"] + ": " + $parameter["operation"]}}',
      version: 1,
    };
  }

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
        if (roam.resource === "message") {
          if (roam.operation === "send") {
            operationResult.push(...(await message.send.call(this, i)));
          }
        } else if (roam.resource === "meeting") {
          if (roam.operation === "create") {
            operationResult.push(...(await meeting.create.call(this, i)));
          }
        } else if (roam.resource === "transcript") {
          if (roam.operation === "list") {
            operationResult.push(...(await transcript.list.call(this, i)));
          } else if (roam.operation === "info") {
            operationResult.push(...(await transcript.info.call(this, i)));
          } else if (roam.operation === "prompt") {
            operationResult.push(...(await transcript.prompt.call(this, i)));
          }
        }
      } catch (err) {
        // transport.toNodeApiError already maps Roam codes (token_revoked, transcript_*, …).
        // Preserve that NodeApiError rather than re-wrapping and losing the message.
        const apiError =
          err instanceof NodeApiError
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
