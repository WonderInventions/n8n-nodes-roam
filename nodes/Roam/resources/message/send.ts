import type { IDataObject, IExecuteFunctions, INodeExecutionData } from "n8n-workflow";
import type { MessageProperties } from "../../interfaces";
import { apiRequest } from "../../transport";

export const sendDescription: MessageProperties = [
  {
    displayName: "Text",
    name: "text",
    type: "string",
    required: true,
    default: "",
    displayOptions: {
      show: {
        operation: ["send"],
        resource: ["message"],
      },
    },
  },
  {
    displayName: "Bot Name",
    name: "botName",
    type: "string",
    default: "n8n",
    displayOptions: {
      show: {
        operation: ["send"],
        resource: ["message"],
      },
    },
  },
  {
    displayName: "Sender Image URL",
    name: "senderImageUrl",
    type: "string",
    default: "",
    displayOptions: {
      show: {
        operation: ["send"],
        resource: ["message"],
      },
    },
  },
  {
    displayName: "Group Name or ID",
    name: "groupId",
    type: "options",
    description:
      'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
    typeOptions: {
      loadOptionsMethod: "getGroups",
    },
    required: true,
    default: "",
    displayOptions: {
      show: {
        operation: ["send"],
        resource: ["message"],
      },
    },
  },
];

export async function send(this: IExecuteFunctions, index: number): Promise<INodeExecutionData[]> {
  const text = this.getNodeParameter("text", index) as string;
  const botName = this.getNodeParameter("botName", index) as string;
  const senderImageUrl = this.getNodeParameter("senderImageUrl", index) as string;
  const groupId = this.getNodeParameter("groupId", index) as string;

  const body: IDataObject = {
    text,
    sender: {
      id: "_",
      name: botName,
      imageUrl: senderImageUrl,
    } as IDataObject,
    recipients: [groupId],
  };

  const responseData = await apiRequest.call(this, "POST", "/v1/chat.sendMessage", body);

  return this.helpers.returnJsonArray(responseData as IDataObject[]);
}
