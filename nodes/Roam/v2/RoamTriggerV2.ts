import {
  ApplicationError,
  type IDataObject,
  type IExecuteFunctions,
  type IHookFunctions,
  type INodeExecutionData,
  type INodeType,
  type INodeTypeBaseDescription,
  type INodeTypeDescription,
  type IWebhookFunctions,
  type IWebhookResponseData,
  type JsonObject,
  NodeApiError,
  NodeConnectionTypes,
} from "n8n-workflow";

import { apiRequest, ROAM_API_VERSION } from "./transport";
import { buildWebhookSubscribeBody, unwrapWebhookPayload, V2_EVENT_MAP } from "./webhook";

export class RoamTriggerV2 implements INodeType {
  description: INodeTypeDescription;

  constructor(baseDescription: INodeTypeBaseDescription) {
    this.description = {
      ...baseDescription,
      version: 2,
      subtitle: '={{$parameter["event"]}}',
      usableAsTool: true,
      defaults: {
        name: "Roam Trigger",
      },
      inputs: [],
      outputs: [NodeConnectionTypes.Main],
      credentials: [
        {
          name: "roamApi",
          required: true,
        },
      ],
      webhooks: [
        {
          name: "default",
          httpMethod: "POST",
          path: "default",
          responseMode: "onReceived",
          responseData: "default",
        },
      ],
      properties: [
        {
          displayName: "Event",
          name: "event",
          type: "options",
          options: [
            {
              name: "Chat Message",
              value: "chatMessage",
              description: "Triggers when a chat message is created, edited, or deleted",
            },
            {
              name: "Meeting Ended",
              value: "meetingEnded",
              description: "Triggers when a meeting ends and its content is ready",
            },
            {
              name: "Meeting Started",
              value: "meetingStarted",
              description: "Triggers when a meeting starts",
            },
            {
              name: "New Recording",
              value: "recordingSaved",
              description: "Triggers when a meeting ends and was video recorded",
            },
            {
              name: "New Transcript",
              value: "transcriptSaved",
              description: "Triggers when a meeting ends and its transcript is ready",
            },
          ],
          default: "meetingEnded",
        },
        {
          displayName: "Chat Type",
          name: "chatType",
          type: "options",
          options: [
            {
              name: "Any",
              value: "",
            },
            {
              name: "Direct Message",
              value: "dm",
            },
            {
              name: "Group",
              value: "group",
            },
          ],
          default: "",
          description: "Only deliver messages from this chat type",
          displayOptions: {
            show: {
              event: ["chatMessage"],
            },
          },
        },
        {
          displayName: "Mentions Only",
          name: "mention",
          type: "boolean",
          default: false,
          description: "Whether to only deliver messages that mention this app",
          displayOptions: {
            show: {
              event: ["chatMessage"],
            },
          },
        },
      ],
    };
  }

  webhookMethods = {
    default: {
      async checkExists(this: IHookFunctions): Promise<boolean> {
        // Always create a new webhook to ensure configuration matches the selected event.
        return false;
      },
      async create(this: IHookFunctions): Promise<boolean> {
        const event = this.getNodeParameter("event") as string;
        const mappedEvent = V2_EVENT_MAP[event];
        if (!mappedEvent) {
          throw new ApplicationError(`Unsupported Roam event "${event}"`);
        }

        const webhookUrl = this.getNodeWebhookUrl("default");
        if (!webhookUrl) {
          throw new ApplicationError("Failed to determine webhook URL");
        }

        const chatType =
          event === "chatMessage" ? (this.getNodeParameter("chatType", "") as string) : undefined;
        const mention =
          event === "chatMessage" ? (this.getNodeParameter("mention", false) as boolean) : undefined;

        const body = buildWebhookSubscribeBody({
          url: webhookUrl,
          event,
          apiVersion: ROAM_API_VERSION,
          chatType,
          mention,
        });

        const response = (await apiRequest.call(
          this,
          "POST",
          "/v1/webhook.subscribe",
          body,
        )) as IDataObject;

        // Persist identifiers for clean unsubscribe
        const webhookId = (response?.id ?? (response as IDataObject)?.ID) as string | undefined;
        const staticData = this.getWorkflowStaticData("node");
        staticData.webhookSubscription = response;
        staticData.webhookEvent = event;
        staticData.webhookId = webhookId;
        staticData.webhookUrl = webhookUrl;

        return true;
      },
      async delete(this: IHookFunctions): Promise<boolean> {
        const staticData = this.getWorkflowStaticData("node");
        const subscription = staticData.webhookSubscription as IDataObject | undefined;
        const storedId =
          (staticData.webhookId as string | undefined) ??
          (subscription?.id as string | undefined) ??
          (subscription?.ID as string | undefined);

        // If nothing to identify the remote webhook, treat as success (idempotent)
        if (!storedId) {
          return true;
        }

        await apiRequest.call(this, "POST", "/v1/webhook.unsubscribe", { id: storedId });
        delete staticData.webhookSubscription;
        delete staticData.webhookEvent;
        delete staticData.webhookId;
        delete staticData.webhookUrl;
        return true;
      },
    },
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const event = this.getNodeParameter("event", 0) as string;
    const mappedEvent = V2_EVENT_MAP[event];

    if (!mappedEvent) {
      throw new ApplicationError(`Unsupported Roam event "${event}"`);
    }

    // Check if we have webhook data from the input
    const inputData = this.getInputData();
    if (inputData && inputData.length > 0 && inputData[0].json) {
      // We're triggered by webhook - use the webhook data instead of API call
      return [inputData];
    }

    // Manual execution - fetch data from API
    try {
      const listResponse = (await apiRequest.call(
        this,
        "GET",
        mappedEvent.listEndpoint,
        {}, // body
        { limit: 1 } // query parameters
      )) as IDataObject;

      const items = ((listResponse[mappedEvent.listProperty] as IDataObject[]) ??
        []) as IDataObject[];

      return [this.helpers.returnJsonArray(items)];
    } catch (err) {
      // Preserve transport's Roam-mapped NodeApiError (auth/transcript codes).
      const apiError =
        err instanceof NodeApiError
          ? err
          : new NodeApiError(this.getNode(), err as JsonObject);
      if (this.continueOnFail()) {
        return [
          [
            {
              json: {},
              error: apiError,
              pairedItem: { item: 0 },
            },
          ],
        ];
      }
      throw apiError;
    }
  }

  async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
    const body = this.getBodyData();

    const responseData = Array.isArray(body) ? body : [body];
    const unwrapped = responseData.map((item) => unwrapWebhookPayload(item as IDataObject));

    return {
      workflowData: [this.helpers.returnJsonArray(unwrapped)],
    };
  }
}
