import type { ICredentialType, INodeProperties } from "n8n-workflow";

export class RoamOAuth2Api implements ICredentialType {
  name = "roamOAuth2Api";

  extends = ["oAuth2Api"];

  displayName = "Roam OAuth2 API";

  // Link to your community node's README
  documentationUrl = "https://developer.ro.am/";

  properties: INodeProperties[] = [
    {
      displayName: "Grant Type",
      name: "grantType",
      type: "hidden",
      default: "authorizationCode",
    },
    {
      displayName: "Authorization URL",
      name: "authUrl",
      type: "string",
      required: true,
      default: "https://api.ro.am/oauth/authorize",
    },
    {
      displayName: "Access Token URL",
      name: "accessTokenUrl",
      type: "string",
      required: true,
      default: "https://api.ro.am/oauth/token",
    },
    {
      displayName: "Scope",
      name: "scope",
      type: "hidden",
      default:
        "chat:send_message groups:read user:read user:read.email recordings:read transcript:read meetinglink:write webhook:write",
    },
    {
      displayName: "Authentication",
      name: "authentication",
      type: "hidden",
      default: "body",
    },
    {
      displayName: "Base URL",
      name: "baseUrl",
      type: "string",
      required: false,
      default: "https://api.ro.am",
      placeholder: "https://api.ro.am or http://localhost:3000",
    },
  ];

  test = {
    request: {
      baseURL: '={{$credentials?.baseUrl || "https://api.ro.am"}}',
      url: "/v0/token.info",
    },
  };
}
