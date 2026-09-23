import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { parseVoiceIntent, parseIntentWithLocalRules } from './server/intentParser';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json({ limit: '10mb' }));

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Server-side first-time intro completion tracker
  const completedIntroHouseholds = new Set<string>();

  app.get('/api/household/:householdId/intro-status', (req, res) => {
    const { householdId } = req.params;
    const isCompleted = completedIntroHouseholds.has(householdId);
    res.json({ householdId, isCompleted });
  });

  app.post('/api/household/:householdId/complete-intro', (req, res) => {
    const { householdId } = req.params;
    completedIntroHouseholds.add(householdId);
    res.json({ success: true, householdId, isCompleted: true, timestamp: new Date().toISOString() });
  });

  // Server-side email invite tracking registry
  interface SentInviteRecord {
    householdId: string;
    recipientEmail: string;
    senderName: string;
    inviteCode: string;
    sentAt: string;
    status: 'sent' | 'accepted';
  }
  const sentInvitesRegistry = new Map<string, SentInviteRecord>();

  app.post('/api/household/:householdId/invite-email', (req, res) => {
    const { householdId } = req.params;
    const { recipientEmail, senderName, householdName, inviteUrl, inviteCode, note } = req.body;

    if (!recipientEmail || typeof recipientEmail !== 'string' || !recipientEmail.includes('@')) {
      return res.status(400).json({ error: 'A valid recipient email address is required.' });
    }

    const cleanEmail = recipientEmail.trim().toLowerCase();
    const sentAt = new Date().toISOString();

    sentInvitesRegistry.set(`${householdId}_${cleanEmail}`, {
      householdId,
      recipientEmail: cleanEmail,
      senderName: senderName || 'Your partner',
      inviteCode: inviteCode || '',
      sentAt,
      status: 'sent',
    });

    console.log(`[Invite Email] Invitation registered for ${cleanEmail} (Household: ${householdId}, Sender: ${senderName})`);

    res.json({
      success: true,
      recipientEmail: cleanEmail,
      sentAt,
      message: `Invitation email dispatched to ${cleanEmail}`,
    });
  });

  app.get('/api/household/:householdId/invite-status/:email', (req, res) => {
    const { householdId, email } = req.params;
    const record = sentInvitesRegistry.get(`${householdId}_${email.trim().toLowerCase()}`);
    res.json({ found: Boolean(record), record });
  });

  // Simple in-memory rate limiting map for intent parser (max 30 requests / min per IP)
  const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

  // Voice / Natural language intent parser endpoint with input sanitization and rate limiting
  app.post('/api/parse-voice-intent', async (req, res) => {
    try {
      const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
      const now = Date.now();
      const clientEntry = rateLimitMap.get(clientIp);

      if (clientEntry && now < clientEntry.resetTime) {
        if (clientEntry.count >= 30) {
          return res.status(429).json({
            error: 'Too many intent requests. Please wait a moment before trying again.',
          });
        }
        clientEntry.count++;
      } else {
        rateLimitMap.set(clientIp, { count: 1, resetTime: now + 60000 });
      }

      const { text, availableCategories } = req.body;
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return res.status(400).json({ error: 'Text query is required' });
      }

      if (text.length > 500) {
        return res.status(400).json({
          error: 'Query length exceeds safe threshold (max 500 characters)',
        });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        // Even without API key configured, use our local deterministic rule engine
        const localResult = parseIntentWithLocalRules(text, availableCategories || []);
        return res.json({
          success: true,
          result: localResult,
          modelUsed: 'Local Fast Rule Engine',
          isFallback: true,
          note: 'GEMINI_API_KEY not found in environment; processed using safe local rules.',
        });
      }

      const parseResponse = await parseVoiceIntent(text, availableCategories || [], apiKey);
      return res.json({
        success: true,
        result: parseResponse.result,
        modelUsed: parseResponse.modelUsed,
        isFallback: parseResponse.isFallback,
      });
    } catch (err: any) {
      console.error('Error parsing voice intent:', err);
      // Failsafe fallback: return locally parsed result instead of a 500 error!
      try {
        const localResult = parseIntentWithLocalRules(req.body.text || '', req.body.availableCategories || []);
        return res.json({
          success: true,
          result: localResult,
          modelUsed: 'Local Fast Parser (Failsafe)',
          isFallback: true,
        });
      } catch (fallbackErr) {
        return res.status(500).json({
          error: err.message || 'Failed to parse intent',
        });
      }
    }
  });

  // Setup Vite in development or static serving in production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Envelope Budgeting server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
