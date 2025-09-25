import type { ICredentialType, INodeProperties } from "n8n-workflow";

export class RoamApi implements ICredentialType {
  name = "roamApi";

  displayName = "Roam API";

  description = "API key for accessing Roam services. The API key should have permissions for: chat messaging, groups, user info, recordings, transcripts, meeting links, and webhooks.";

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
      displayName: "Base URL",
      name: "baseUrl",
      type: "hidden",
      description: "Set this to http://localhost:5587 for local development.",
      required: false,
      default: "https://api.ro.am",
    },
  ];

  test = {
    request: {
      baseURL: '={{$credentials?.baseUrl || "https://api.ro.am"}}',
      url: "/v0/token.info",
      headers: {
        Authorization: '=Bearer {{$credentials?.apiKey}}',
      },
    },
  };
}
