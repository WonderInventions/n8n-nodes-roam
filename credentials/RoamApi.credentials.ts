import type { IAuthenticateGeneric, Icon, ICredentialType, INodeProperties } from "n8n-workflow";

export class RoamApi implements ICredentialType {
  name = "roamApi";

  displayName = "Roam API";

  icon: Icon = {
    light: "file:../nodes/Roam/roam.svg",
    dark: "file:../nodes/Roam/roam.dark.svg",
  };

  description = "API key for accessing Roam services. The API key should have permissions for: chat messaging, chat history, groups, user info, meetings, recordings, meeting links, and webhooks.";

  // Link to your community node's README
  documentationUrl = "https://developer.ro.am/";

  properties: INodeProperties[] = [
    {
      displayName: "API Key",
      name: "apiKey",
      type: "string",
      typeOptions: {
        password: true,
      },
      description: "Your Roam API key obtained from Roam Administration > Developer",
      required: true,
      default: "",
    },
    {
      displayName: "Webhook Signing Secret",
      name: "webhookSigningSecret",
      type: "string",
      typeOptions: {
        password: true,
      },
      description:
        "Standard Webhooks signing secret for this API client, shown alongside the API key in Roam Administration > Developer. When set, the Roam Trigger rejects any delivery whose webhook-signature header does not verify. Leave empty only if you accept that anyone who learns your n8n webhook URL can inject fabricated Roam events into this workflow.",
      required: false,
      default: "",
    },
    {
      displayName: "Base URL",
      name: "baseUrl",
      type: "hidden",
      required: false,
      description: "Local Development: Set this to http://localhost:5587",
      default: "https://api.ro.am",
    },
  ];

  authenticate: IAuthenticateGeneric = {
    type: "generic",
    properties: {
      headers: {
        Authorization: '=Bearer {{$credentials?.apiKey}}',
      },
    },
  };

  test = {
    request: {
      baseURL: '={{ $credentials.baseUrl }}',
      // Local Development: Set this to http://localhost:5587/v1/token.info
      url: `/v1/token.info`,
    },
  };
}
