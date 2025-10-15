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

function ensureHeaders(headers: IDataObject | undefined) {
  if (headers === undefined) {
    return {} as IDataObject;
  }
  return headers;
}

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
    | (ICredentialDataDecryptedObject & {
        apiKey: string;
        baseUrl?: string;
      })
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
    },
    body,
    qs,
    ...optionOverrides,
  };

  const headers = ensureHeaders(requestOptions.headers);
  headers["Authorization"] = `Bearer ${credentials.apiKey}`;
  requestOptions.headers = headers;

  if (Object.keys(requestOptions.body as IDataObject).length === 0) {
    delete requestOptions.body;
  }

  if (Object.keys(requestOptions.qs as IDataObject).length === 0) {
    delete requestOptions.qs;
  }

  this.logger.debug(`[Roam API Request] ${method} ${baseUrl}${endpoint}`);
  if (requestOptions.body && Object.keys(requestOptions.body).length > 0) {
    this.logger.debug(
      `[Roam API Request Body] ${JSON.stringify(requestOptions.body, null, 2)}`,
    );
  }
  if (requestOptions.qs && Object.keys(requestOptions.qs).length > 0) {
    this.logger.debug(`[Roam API Request Query] ${JSON.stringify(requestOptions.qs, null, 2)}`);
  }

  try {
    const response = await this.helpers.httpRequest(requestOptions);
    this.logger.debug(`[Roam API Response] ${method} ${endpoint} - Success`);
    return response;
  } catch (error) {
    this.logger.error(`[Roam API Error] ${method} ${endpoint}`);
    if (requestOptions.body) {
      this.logger.error(
        `[Roam API Error Body] ${JSON.stringify(requestOptions.body, null, 2)}`,
      );
    }
    throw new NodeApiError(this.getNode(), error as JsonObject);
  }
}
