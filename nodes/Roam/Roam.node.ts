import type {
  IDataObject,
  IExecuteFunctions,
  ILoadOptionsFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from "n8n-workflow";

import { NodeConnectionType } from "n8n-workflow";

import * as meeting from "./resources/meeting";
import * as message from "./resources/message";

import type { Roam as RoamType } from "./interfaces";
import { apiRequest } from "./transport";

type RoamEntity = RoamType;

const loadOptions = {
  async getGroups(this: ILoadOptionsFunctions): Promise<Array<{ name: string; value: string }>> {
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

async function router(this: IExecuteFunctions): Promise<INodeExecutionData[]> {
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
      }
    } catch (err) {
      if (this.continueOnFail()) {
        operationResult.push({ json: this.getInputData(i)[0].json, error: err });
      } else {
        throw err;
      }
    }
  }

  return operationResult;
}

export class Roam implements INodeType {
  description: INodeTypeDescription = {
    name: "roam",
    displayName: "Roam",
    description: "Interact with Roam",
    group: ["transform"],
    icon: { light: "file:roam.svg", dark: "file:roam.dark.svg" },
    inputs: [NodeConnectionType.Main],
    outputs: [NodeConnectionType.Main],
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

  async execute(this: IExecuteFunctions) {
    return [await router.call(this)];
  }
}
