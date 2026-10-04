import { parseIntentWithLocalRules, parseVoiceIntent } from '../../server/intentParser';
import {
  jsonResponse,
  optionsResponse,
  parseJsonBody,
  NetlifyFunctionEvent,
  NetlifyFunctionHandler,
} from './lib/response';

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function getClientIp(event: NetlifyFunctionEvent): string {
  return (
    event.headers['x-forwarded-for'] ||
    event.headers['client-ip'] ||
    event.headers['x-nf-client-connection-ip'] ||
    'unknown'
  ).split(',')[0].trim();
}

function isRateLimited(clientIp: string): boolean {
  const now = Date.now();
  const clientEntry = rateLimitMap.get(clientIp);

  if (clientEntry && now < clientEntry.resetTime) {
    if (clientEntry.count >= 30) {
      return true;
    }
    clientEntry.count += 1;
    return false;
  }

  rateLimitMap.set(clientIp, { count: 1, resetTime: now + 60000 });
  return false;
}

export const handler: NetlifyFunctionHandler = async event => {
  if (event.httpMethod === 'OPTIONS') {
    return optionsResponse();
  }

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  try {
    const clientIp = getClientIp(event);
    if (isRateLimited(clientIp)) {
      return jsonResponse(429, {
        error: 'Too many intent requests. Please wait a moment before trying again.',
      });
    }

    const body = parseJsonBody(event);
    const text = body.text;
    const availableCategories = Array.isArray(body.availableCategories)
      ? body.availableCategories
      : [];

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return jsonResponse(400, { error: 'Text query is required' });
    }

    if (text.length > 500) {
      return jsonResponse(400, {
        error: 'Query length exceeds safe threshold (max 500 characters)',
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      const localResult = parseIntentWithLocalRules(text, availableCategories as string[]);
      return jsonResponse(200, {
        success: true,
        result: localResult,
        modelUsed: 'Local Fast Rule Engine',
        isFallback: true,
        note: 'GEMINI_API_KEY not found in environment; processed using safe local rules.',
      });
    }

    const parseResponse = await parseVoiceIntent(text, availableCategories as string[], apiKey);
    return jsonResponse(200, {
      success: true,
      result: parseResponse.result,
      modelUsed: parseResponse.modelUsed,
      isFallback: parseResponse.isFallback,
    });
  } catch (err: unknown) {
    try {
      const body = parseJsonBody(event);
      const text = typeof body.text === 'string' ? body.text : '';
      const availableCategories = Array.isArray(body.availableCategories)
        ? body.availableCategories
        : [];
      const localResult = parseIntentWithLocalRules(text, availableCategories as string[]);
      return jsonResponse(200, {
        success: true,
        result: localResult,
        modelUsed: 'Local Fast Parser (Failsafe)',
        isFallback: true,
      });
    } catch {
      const message = err instanceof Error ? err.message : 'Failed to parse intent';
      return jsonResponse(500, { error: message });
    }
  }
};
