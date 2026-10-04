export interface NetlifyFunctionEvent {
  httpMethod: string;
  body: string | null;
  headers: Record<string, string | undefined>;
  path: string;
}

export interface NetlifyFunctionResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
}

export type NetlifyFunctionHandler = (
  event: NetlifyFunctionEvent
) => Promise<NetlifyFunctionResponse> | NetlifyFunctionResponse;

const jsonHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};

export function jsonResponse(statusCode: number, payload: unknown): NetlifyFunctionResponse {
  return {
    statusCode,
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  };
}

export function optionsResponse(): NetlifyFunctionResponse {
  return {
    statusCode: 204,
    headers: jsonHeaders,
    body: '',
  };
}

export function parseJsonBody(event: NetlifyFunctionEvent): Record<string, unknown> {
  if (!event.body) return {};
  const parsed = JSON.parse(event.body);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
}
