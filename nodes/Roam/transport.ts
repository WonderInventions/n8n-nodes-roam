import { NodeApiError } from "n8n-workflow";
import type {
  ICredentialDataDecryptedObject,
  IDataObject,
  IExecuteFunctions,
  IHookFunctions,
  IHttpRequestMethods,
  IHttpRequestOptions,
  ILoadOptionsFunctions,
  IWebhookFunctions,
  JsonObject,
} from "n8n-workflow";

type RoamFunctions = IExecuteFunctions | ILoadOptionsFunctions | IWebhookFunctions | IHookFunctions;

// Advertised to the Roam appserver on every request for version attribution in
// logs and Datadog (@plugin.name:n8n-nodes-roam / @plugin.version). Keep in sync
// with package.json "version".
const ROAM_USER_AGENT = "n8n-nodes-roam/0.1.11";

/**
 * Make an API request to Roam
 */
export async function apiRequest(
  this: RoamFunctions,
  method: "GET" | "POST" | "PUT" | "DELETE",
  endpoint: string,
  body: IDataObject = {},
  qs: IDataObject = {},
  optionOverrides: Partial<IHttpRequestOptions> = {}
) {
  const credentials = (await this.getCredentials("roamApi")) as
    | (ICredentialDataDecryptedObject & { baseUrl?: string })
    | undefined;

  if (!credentials) {
    throw new Error("No credentials returned for Roam API");
  }

  const baseUrl = (credentials.baseUrl as string | undefined) ?? "https://api.ro.am";

  const requestOptions: IHttpRequestOptions = {
    method: method as IHttpRequestMethods,
    url: `${baseUrl}${endpoint}`,
    json: true,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": ROAM_USER_AGENT,
    },
    body,
    qs,
    ...optionOverrides,
  };

  if (Object.keys(requestOptions.body as IDataObject).length === 0) {
    delete requestOptions.body;
  }

  if (Object.keys(requestOptions.qs as IDataObject).length === 0) {
    delete requestOptions.qs;
  }

  try {
    return await this.helpers.httpRequestWithAuthentication.call(this, "roamApi", requestOptions);
  } catch (error) {
    throw new NodeApiError(this.getNode(), error as JsonObject);
  }
}
