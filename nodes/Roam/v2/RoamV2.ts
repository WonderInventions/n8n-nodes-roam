import type {
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

import type { Roam as RoamType } from "./interfaces";
import { apiRequestAllPages } from "./transport";

type RoamEntity = RoamType;

const loadOptions = {
  async getGroups(this: ILoadOptionsFunctions): Promise<Array<{ name: string; value: string }>> {
    const groups = await apiRequestAllPages.call(this, "/v1/group.list", "groups");

    return groups.map((group) => ({
      name: (group.name as string) ?? (group.id as string),
      value: group.id as string,
      description: group.type as string | undefined,
    }));
  },
  async getUsers(this: ILoadOptionsFunctions): Promise<Array<{ name: string; value: string }>> {
    const users = await apiRequestAllPages.call(this, "/v1/user.list", "users");

    return users.map((user) => {
      const name = (user.name as string) || (user.id as string);
      const email = user.email as string | undefined;
      return {
        name: email ? `${name} (${email})` : name,
        value: user.id as string,
      };
    });
  },
};

export class RoamV2 implements INodeType {
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
          ],
          default: "message",
        },
        ...message.messageDescription,
        ...meeting.meetingDescription,
      ],
      subtitle: '={{$parameter["resource"] + ": " + $parameter["operation"]}}',
      version: 2,
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
          } else if (roam.operation === "list") {
            operationResult.push(...(await meeting.list.call(this, i)));
          } else if (roam.operation === "info") {
            operationResult.push(...(await meeting.info.call(this, i)));
          } else if (roam.operation === "transcript") {
            operationResult.push(...(await meeting.transcript.call(this, i)));
          } else if (roam.operation === "prompt") {
            operationResult.push(...(await meeting.prompt.call(this, i)));
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
