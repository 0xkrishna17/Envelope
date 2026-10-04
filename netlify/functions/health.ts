import { jsonResponse, optionsResponse, NetlifyFunctionHandler } from './lib/response';

export const handler: NetlifyFunctionHandler = event => {
  if (event.httpMethod === 'OPTIONS') {
    return optionsResponse();
  }

  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  return jsonResponse(200, { status: 'ok', timestamp: new Date().toISOString() });
};
