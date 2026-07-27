import {
  ApplicationError,
  type ICredentialDataDecryptedObject,
  type IDataObject,
  type IExecuteFunctions,
  type IHookFunctions,
  type INodeExecutionData,
  type INodeType,
  type INodeTypeDescription,
  type IWebhookFunctions,
  type IWebhookResponseData,
  type JsonObject,
  NodeApiError,
  NodeConnectionTypes,
} from "n8n-workflow";

import { getGroups } from "./loadOptions";
import { apiRequest } from "./transport";
import { ROAM_API_VERSION } from "./version";
import {
  unwrapWebhookEnvelope,
  verifyStandardWebhookSignature,
  webhookEnvelopeMeta,
} from "./webhooks";

interface EventDefinition {
  /** The event name Roam's registry knows. Dot-named events are v1. */
  apiValue: string;
  /** Endpoint used to fetch sample data during a manual (Test step) execution. */
  listEndpoint: string;
  /** Key holding the array in that endpoint's response. */
  listProperty: string;
  /** Extra query params for the manual-execution fetch. */
  listQuery?: IDataObject;
}

/**
 * Colon-named events are v0 and are not date-versioned; dot-named events are v1,
 * are date-versioned, and must be subscribed through /v1 so the version pin is
 * honored (the /v0 route discards it and freezes the subscription at whatever
 * the API client's account default happens to be).
 */
const isV1Event = (apiValue: string): boolean => apiValue.includes(".");

const EVENT_MAP: Record<string, EventDefinition> = {
  recordingSaved: {
    // No dot-named equivalent exists in Roam's event registry, and
    // /v1/webhook.subscribe rejects colon-named names, so this one keeps a v0
    // subscribe. Teardown and signature verification are still on the v1 path.
    apiValue: "recording:saved",
    listEndpoint: "/v1/recording.list",
    listProperty: "recordings",
  },
  transcriptSaved: {
    apiValue: "transcript:saved",
    listEndpoint: "/v0/transcript.list",
    listProperty: "transcripts",
  },
  meetingEnded: {
    apiValue: "meeting.ended",
    listEndpoint: "/v1/meeting.list",
    listProperty: "meetings",
  },
  chatMessage: {
    apiValue: "chat.message",
    // There is no v1 endpoint that lists messages across chats, so the manual
    // Test step samples history from one group the credential can see.
    listEndpoint: "/v1/chat.history",
    listProperty: "messages",
  },
};

export class RoamTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: "Roam Trigger",
    name: "roamTrigger",
    icon: { light: "file:roam.svg", dark: "file:roam.dark.svg" },
    group: ["trigger"],
    version: 1,
    description: "Handle Roam webhooks",
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
        // Signature verification must run over the exact bytes Roam signed;
        // re-serializing the parsed body changes key order and whitespace and
        // would never match.
        rawBody: true,
      },
    ],
    properties: [
      {
        displayName: "Event",
        name: "event",
        type: "options",
        options: [
          {
            name: "Meeting Ended",
            value: "meetingEnded",
            description:
              "Triggers when a recorded meeting ends and its content is ready",
          },
          {
            name: "New Chat Message",
            value: "chatMessage",
            description: "Triggers when a message is posted in Roam",
          },
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
      {
        displayName: "Chats to Monitor",
        name: "chatScope",
        type: "options",
        options: [
          { name: "All Chats", value: "all" },
          { name: "Direct Messages Only", value: "dm" },
          { name: "Group Chats Only", value: "group" },
        ],
        default: "all",
        description:
          "Which conversations trigger the workflow. Roam only delivers messages this API key can see.",
        displayOptions: {
          show: {
            event: ["chatMessage"],
          },
        },
      },
      {
        displayName: "Only When Mentioned",
        name: "mentionOnly",
        type: "boolean",
        default: false,
        description:
          "Whether to trigger only for messages that mention this app (or @all)",
        displayOptions: {
          show: {
            event: ["chatMessage"],
          },
        },
      },
      {
        displayName: "Group Name or ID",
        name: "sampleGroupId",
        type: "options",
        typeOptions: {
          loadOptionsMethod: "getGroups",
        },
        default: "",
        description:
          'Group whose recent messages are used as sample data when you press "Test step". Not a filter — it has no effect on live deliveries. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
        displayOptions: {
          show: {
            event: ["chatMessage"],
          },
        },
      },
      {
        displayName: "Only Meetings With Video",
        name: "hasVideoOnly",
        type: "boolean",
        default: false,
        description:
          "Whether to trigger only for meetings that have a video recording",
        displayOptions: {
          show: {
            event: ["meetingEnded"],
          },
        },
      },
    ],
  };

  methods = {
    loadOptions: { getGroups },
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

        const body: IDataObject = {
          url: webhookUrl,
          event: mappedEvent.apiValue,
        };
        let endpoint = "/v0/webhook.subscribe";

        if (isV1Event(mappedEvent.apiValue)) {
          endpoint = "/v1/webhook.subscribe";
          // Pin the frozen delivery shape to this release. Without it the
          // subscription freezes at the API client's account default, which
          // moves under us and silently changes payload shapes.
          body.apiVersion = ROAM_API_VERSION;

          const filter = buildEventFilter(this, event);
          if (filter) {
            body.filter = filter;
          }
        }

        const response = (await apiRequest.call(
          this,
          "POST",
          endpoint,
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

        // POST with a JSON `{ id }` body. Both webhook.unsubscribe routes are
        // registered POST-only; the v0 form took the id as a query parameter,
        // the v1 form takes it in the body.
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
    const mappedEvent = EVENT_MAP[event];

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
      const qs: IDataObject = { limit: 1, ...(mappedEvent.listQuery ?? {}) };
      if (event === "chatMessage") {
        const sampleGroupId = this.getNodeParameter("sampleGroupId", 0, "") as string;
        if (!sampleGroupId) {
          // chat.history needs a destination; without one there is nothing
          // meaningful to sample, and an unfiltered call would 400.
          return [this.helpers.returnJsonArray([])];
        }
        qs.groupId = sampleGroupId;
        qs.limit = 3;
      }

      const listResponse = (await apiRequest.call(
        this,
        "GET",
        mappedEvent.listEndpoint,
        {}, // body
        qs,
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
    const credentials = (await this.getCredentials(
      "roamApi",
    )) as ICredentialDataDecryptedObject & { webhookSigningSecret?: string };
    const secret = (credentials?.webhookSigningSecret as string | undefined) ?? "";

    if (secret) {
      const request = this.getRequestObject();
      const rawBody = readRawBody(request);
      const result = verifyStandardWebhookSignature(
        secret,
        this.getHeaderData() as Record<string, unknown>,
        rawBody,
      );

      if (!result.ok) {
        // Do not start the workflow on unauthenticated data. Answering 401
        // rather than 200 also tells Roam the delivery failed, so it retries —
        // a transient clock-skew rejection self-heals instead of being dropped.
        // Returning no workflowData is what stops the execution.
        const response = this.getResponseObject();
        response
          .status(401)
          .json({ error: "invalid_signature", reason: result.reason });
        return { noWebhookResponse: true };
      }
    }

    const body = this.getBodyData();

    // v1 deliveries are wrapped in { type, eventId, timestamp, apiVersion, data }
    // from apiVersion 2026-07-07 onward; v0 deliveries and older pins are bare.
    // Emit the payload at the top level either way, with envelope metadata
    // alongside it so downstream nodes can de-dupe on the stable eventId.
    const items = Array.isArray(body) ? body : [body];
    const json = items.map((item) => ({
      ...unwrapWebhookEnvelope(item),
      ...webhookEnvelopeMeta(item),
    }));

    return {
      workflowData: [this.helpers.returnJsonArray(json as IDataObject[])],
    };
  }
}

/**
 * Server-side subscription filters for the v1 events that support them.
 *
 * Roam rejects an empty filter object with a 400 ("must specify at least one
 * constraint"), so an unconstrained subscription must send no filter at all.
 */
function buildEventFilter(
  context: IHookFunctions,
  event: string,
): IDataObject | undefined {
  const filter: IDataObject = {};

  if (event === "chatMessage") {
    // IHookFunctions has no items, so getNodeParameter takes (name, fallback).
    const chatScope = context.getNodeParameter("chatScope", "all") as string;
    if (chatScope === "dm" || chatScope === "group") {
      filter.chatType = chatScope;
    }
    if (context.getNodeParameter("mentionOnly", false) as boolean) {
      filter.mention = true;
    }
  }

  if (event === "meetingEnded") {
    if (context.getNodeParameter("hasVideoOnly", false) as boolean) {
      // {"hasVideo": false} is rejected — omit the filter to receive everything.
      filter.hasVideo = true;
    }
  }

  return Object.keys(filter).length > 0 ? filter : undefined;
}

/**
 * Recover the raw request body for signature verification.
 *
 * `rawBody: true` on the webhook description makes n8n keep the untouched bytes
 * on the request object. Different n8n versions expose it as a Buffer or a
 * string, so normalize both.
 */
function readRawBody(request: unknown): string | undefined {
  if (!request || typeof request !== "object") {
    return undefined;
  }
  const raw = (request as { rawBody?: unknown }).rawBody;
  if (typeof raw === "string") {
    return raw;
  }
  if (Buffer.isBuffer(raw)) {
    return raw.toString("utf8");
  }
  return undefined;
}
