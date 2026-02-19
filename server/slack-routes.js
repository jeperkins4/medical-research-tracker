/**
 * Slack API Routes
 * 
 * Handles:
 * - Slash commands (/health)
 * - Event subscriptions (app mentions, DMs)
 * - Interactive components (buttons, menus)
 */

import express from 'express';
import {
  handleSlashCommand,
  sendSlackMessage,
  sendEphemeralMessage,
  verifySlackSignature
} from './slack-integration.js';

export function setupSlackRoutes(app) {
  const router = express.Router();

  /**
   * Slash Command Handler
   * POST /api/slack/commands
   * 
   * Handles: /health vitals, /health meds, /health search, etc.
   */
  router.post('/commands', express.urlencoded({ extended: true }), async (req, res) => {
    try {
      // Verify request is from Slack
      const signature = req.headers['x-slack-signature'];
      const timestamp = req.headers['x-slack-request-timestamp'];
      const body = JSON.stringify(req.body);

      // Verify signature (security)
      if (signature && timestamp) {
        const isValid = await verifySlackSignature(signature, timestamp, body);
        if (!isValid) {
          console.warn('[Slack] Invalid signature');
          return res.status(401).json({ error: 'Invalid signature' });
        }
      }

      // Check timestamp (prevent replay attacks)
      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - parseInt(timestamp)) > 300) {
        console.warn('[Slack] Request timestamp too old');
        return res.status(401).json({ error: 'Request expired' });
      }

      // Handle command
      const response = await handleSlashCommand(
        req.body,
        req.body.user_id,
        req.body.channel_id
      );

      res.json(response);
    } catch (err) {
      console.error('[Slack] Error handling command:', err);
      res.status(500).json({
        response_type: 'ephemeral',
        text: '❌ Sorry, something went wrong.'
      });
    }
  });

  /**
   * Event Subscriptions Handler
   * POST /api/slack/events
   * 
   * Handles: app_mention, message.im (DMs), etc.
   */
  router.post('/events', express.json(), async (req, res) => {
    try {
      const { type, challenge, event } = req.body;

      // URL verification (Slack setup)
      if (type === 'url_verification') {
        return res.json({ challenge });
      }

      // Event callback
      if (type === 'event_callback') {
        // Acknowledge immediately (Slack expects response within 3 seconds)
        res.status(200).send();

        // Process event asynchronously
        handleSlackEvent(event);
        return;
      }

      res.status(200).send();
    } catch (err) {
      console.error('[Slack] Error handling event:', err);
      res.status(500).send();
    }
  });

  /**
   * Interactive Components Handler
   * POST /api/slack/interactive
   * 
   * Handles: button clicks, menu selections, etc.
   */
  router.post('/interactive', express.urlencoded({ extended: true }), async (req, res) => {
    try {
      const payload = JSON.parse(req.body.payload);

      // Acknowledge immediately
      res.status(200).send();

      // Handle interaction asynchronously
      handleSlackInteraction(payload);
    } catch (err) {
      console.error('[Slack] Error handling interaction:', err);
      res.status(500).send();
    }
  });

  /**
   * Manual Trigger Endpoints (for testing/cron)
   */
  
  // Send daily health summary
  router.post('/send-daily-summary', async (req, res) => {
    try {
      const channel = req.body.channel || process.env.SLACK_DEFAULT_CHANNEL;
      
      if (!channel) {
        return res.status(400).json({ error: 'Channel required' });
      }

      const { sendDailyHealthSummary } = await import('./slack-integration.js');
      await sendDailyHealthSummary(channel);
      
      res.json({ success: true, message: 'Daily summary sent' });
    } catch (err) {
      console.error('[Slack] Error sending daily summary:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Send new research alert
  router.post('/send-research-alert', async (req, res) => {
    try {
      const { papers, channel } = req.body;
      
      if (!papers || !Array.isArray(papers)) {
        return res.status(400).json({ error: 'Papers array required' });
      }

      const { sendNewResearchAlert } = await import('./slack-integration.js');
      await sendNewResearchAlert(papers, channel);
      
      res.json({ success: true, message: `Alert sent for ${papers.length} papers` });
    } catch (err) {
      console.error('[Slack] Error sending research alert:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Send custom message
  router.post('/send-message', async (req, res) => {
    try {
      const { channel, text, blocks } = req.body;
      
      if (!channel || !text) {
        return res.status(400).json({ error: 'Channel and text required' });
      }

      const result = await sendSlackMessage(channel, text, blocks);
      
      if (result) {
        res.json({ success: true, ts: result.ts });
      } else {
        res.status(500).json({ error: 'Failed to send message' });
      }
    } catch (err) {
      console.error('[Slack] Error sending message:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.use('/api/slack', router);
  console.log('✅ Slack routes configured');
}

/**
 * Handle Slack Events (async)
 */
async function handleSlackEvent(event) {
  try {
    switch (event.type) {
      case 'app_mention':
        await handleAppMention(event);
        break;
      
      case 'message':
        if (event.channel_type === 'im') {
          await handleDirectMessage(event);
        }
        break;
      
      default:
        console.log(`[Slack] Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error('[Slack] Error handling event:', err);
  }
}

/**
 * Handle @MyTreatmentPath mentions in channels
 */
async function handleAppMention(event) {
  const text = event.text.replace(/<@[A-Z0-9]+>/g, '').trim();
  
  // Simple NLP: detect intent from message
  if (text.toLowerCase().includes('vitals') || text.toLowerCase().includes('blood pressure')) {
    const response = await handleSlashCommand({ text: 'vitals' }, event.user, event.channel);
    await sendEphemeralMessage(event.channel, event.user, response.text, response.blocks);
  } else if (text.toLowerCase().includes('medication') || text.toLowerCase().includes('meds')) {
    const response = await handleSlashCommand({ text: 'meds' }, event.user, event.channel);
    await sendEphemeralMessage(event.channel, event.user, response.text, response.blocks);
  } else if (text.toLowerCase().includes('search')) {
    const query = text.replace(/search/i, '').trim();
    const response = await handleSlashCommand({ text: `search ${query}` }, event.user, event.channel);
    await sendEphemeralMessage(event.channel, event.user, response.text, response.blocks);
  } else {
    // Generic help
    const response = await handleSlashCommand({ text: 'help' }, event.user, event.channel);
    await sendEphemeralMessage(event.channel, event.user, response.text, response.blocks);
  }
}

/**
 * Handle Direct Messages (more permissive for PHI)
 */
async function handleDirectMessage(event) {
  // Skip bot messages
  if (event.bot_id) return;

  const text = event.text.toLowerCase();
  
  // Route to appropriate handler based on message content
  if (text.includes('vitals')) {
    const response = await handleSlashCommand({ text: 'vitals' }, event.user, event.channel);
    await sendSlackMessage(event.channel, response.text, response.blocks);
  } else if (text.includes('medication') || text.includes('meds')) {
    const response = await handleSlashCommand({ text: 'meds' }, event.user, event.channel);
    await sendSlackMessage(event.channel, response.text, response.blocks);
  } else if (text.includes('labs') || text.includes('tests')) {
    const response = await handleSlashCommand({ text: 'labs' }, event.user, event.channel);
    await sendSlackMessage(event.channel, response.text, response.blocks);
  } else if (text.includes('search')) {
    const query = text.replace(/search/i, '').trim();
    const response = await handleSlashCommand({ text: `search ${query}` }, event.user, event.channel);
    await sendSlackMessage(event.channel, response.text, response.blocks);
  } else {
    // Help message
    await sendSlackMessage(event.channel, 
      "👋 Hi! I'm your MyTreatmentPath assistant.\n\n" +
      "Try asking me:\n" +
      "• \"Show me my vitals\"\n" +
      "• \"What medications am I on?\"\n" +
      "• \"Show my recent labs\"\n" +
      "• \"Search for immunotherapy papers\"\n\n" +
      "Or use `/health <command>` for quick access."
    );
  }
}

/**
 * Handle Interactive Components (buttons, menus, etc.)
 */
async function handleSlackInteraction(payload) {
  const { type, actions, user, channel } = payload;
  
  switch (type) {
    case 'block_actions':
      // Handle button clicks
      if (actions && actions.length > 0) {
        const action = actions[0];
        
        // Example: "View Full Report" button
        if (action.action_id === 'view_full_report') {
          await sendEphemeralMessage(
            channel.id,
            user.id,
            'Full report feature coming soon! 📊'
          );
        }
      }
      break;
    
    default:
      console.log(`[Slack] Unhandled interaction type: ${type}`);
  }
}
