import { describe, expect, it } from 'vitest';
import { handler } from '../functions/parse-voice-intent';

const baseEvent = {
  headers: { 'x-forwarded-for': '127.0.0.1' },
  path: '/.netlify/functions/parse-voice-intent',
};

describe('Netlify parse voice intent function', () => {
  it('uses local parser fallback when GEMINI_API_KEY is unavailable', async () => {
    const originalKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    const response = await handler({
      ...baseEvent,
      httpMethod: 'POST',
      body: JSON.stringify({
        text: 'spent 450 on groceries with card',
        availableCategories: ['Groceries', 'Dining'],
      }),
    });

    if (originalKey !== undefined) {
      process.env.GEMINI_API_KEY = originalKey;
    }

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.isFallback).toBe(true);
    expect(body.result.intent).toBe('add_transaction');
    expect(body.result.amountInPaise).toBe(45000);
    expect(body.result.categoryName).toBe('Groceries');
  });

  it('rejects empty text requests', async () => {
    const response = await handler({
      ...baseEvent,
      httpMethod: 'POST',
      body: JSON.stringify({ text: '', availableCategories: [] }),
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error).toBe('Text query is required');
  });
});
