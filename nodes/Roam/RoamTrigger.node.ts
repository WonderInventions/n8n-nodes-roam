import {
  ApplicationError,
  type IDataObject,
  type IExecuteFunctions,
  type IHookFunctions,
  type INodeExecutionData,
  type INodeType,
  type INodeTypeDescription,
  type IWebhookFunctions,
  type IWebhookResponseData,
  NodeConnectionType,
} from "n8n-workflow";

import { apiRequest } from "./transport";

const EVENT_MAP: Record<string, { apiValue: string; listEndpoint: string; listProperty: string }> =
  {
    recordingSaved: {
      apiValue: "recording:saved",
      listEndpoint: "/v1/recording.list",
      listProperty: "recordings",
    },
    transcriptSaved: {
      apiValue: "transcript:saved",
      listEndpoint: "/v0/transcript.list",
      listProperty: "transcripts",
    },
  };

export class RoamTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: "Roam Trigger",
    name: "roamTrigger",
    icon: "fa:robot",
    group: ["trigger"],
    version: 1,
    description: "Handle Roam webhooks",
    defaults: {
      name: "Roam Trigger",
    },
    inputs: [],
    outputs: [NodeConnectionType.Main],
    credentials: [
      {
        name: "roamOAuth2Api",
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
            name: "New Recording",
            value: "recordingSaved",
            description: "Triggers when a new meeting recording is saved",
          },
          {
            name: "New Transcript",
            value: "transcriptSaved",
            description: "Triggers when a new transcript is saved",
          },
        ],
        default: "recordingSaved",
      },
    ],
  };

  webhookMethods = {
    default: {
      async checkExists(this: IHookFunctions): Promise<boolean> {
        // Always create a new webhook to ensure configuration matches the selected event.
        return false;
      },
      async create(this: IHookFunctions): Promise<boolean> {
        const event = this.getNodeParameter("event", 0) as string;
        const mappedEvent = EVENT_MAP[event];
        if (!mappedEvent) {
          throw new ApplicationError(`Unsupported Roam event "${event}"`);
        }

        const webhookUrl = this.getNodeWebhookUrl("default");
        if (!webhookUrl) {
          throw new ApplicationError("Failed to determine webhook URL");
        }

        const response = (await apiRequest.call(this, "POST", "/v0/webhook.subscribe", {
          url: webhookUrl,
          event: mappedEvent.apiValue,
        })) as IDataObject;

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

        await apiRequest.call(this, "POST", "/v0/webhook.unsubscribe", undefined, { id: storedId });
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
    const mappedEvent = EVENT_MAP[event];

    if (!mappedEvent) {
      throw new ApplicationError(`Unsupported Roam event "${event}"`);
    }

    // Check if we have webhook data from the input
    const inputData = this.getInputData();
    if (inputData && inputData.length > 0 && inputData[0].json) {
      // We're triggered by webhook - use the webhook data instead of API call
      this.logger.info(`Using webhook data instead of API polling`);
      return [inputData];
    }

    // Manual execution - fetch data from API
    this.logger.info(`Manual execution - fetching data from API`);
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
  }

  async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
    const body = this.getBodyData();

    const responseData = Array.isArray(body) ? body : [body];

    return {
      workflowData: [this.helpers.returnJsonArray(responseData as IDataObject[])],
    };
  }
}
