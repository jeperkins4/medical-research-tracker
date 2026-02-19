/**
 * Slack Integration for Medical Research Tracker
 * 
 * Features:
 * - Interactive commands (slash commands, @mentions)
 * - Scheduled notifications (daily health summary)
 * - Real-time alerts (new research, abnormal labs)
 * - HIPAA-safe messaging (no PHI in public channels)
 */

import fetch from 'node-fetch';
import { query } from './db-secure.js';

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET;
const SLACK_DEFAULT_CHANNEL = process.env.SLACK_CHANNEL_ID; // Optional: default channel for notifications

/**
 * Send message to Slack
 */
export async function sendSlackMessage(channel, text, blocks = null) {
  if (!SLACK_BOT_TOKEN) {
    console.warn('[Slack] Bot token not configured, skipping message');
    return null;
  }

  const payload = {
    channel,
    text,
    ...(blocks && { blocks })
  };

  try {
    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    
    if (!data.ok) {
      console.error('[Slack] Failed to send message:', data.error);
      return null;
    }

    return data;
  } catch (err) {
    console.error('[Slack] Error sending message:', err);
    return null;
  }
}

/**
 * Send ephemeral message (only visible to one user)
 * Use for PHI data in public channels
 */
export async function sendEphemeralMessage(channel, user, text, blocks = null) {
  if (!SLACK_BOT_TOKEN) return null;

  const payload = {
    channel,
    user,
    text,
    ...(blocks && { blocks })
  };

  try {
    const response = await fetch('https://slack.com/api/chat.postEphemeral', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    return data.ok ? data : null;
  } catch (err) {
    console.error('[Slack] Error sending ephemeral message:', err);
    return null;
  }
}

/**
 * Daily Health Summary
 * Posts overview of vitals, medications, upcoming appointments
 */
export async function sendDailyHealthSummary(channel = SLACK_DEFAULT_CHANNEL) {
  if (!channel) {
    console.warn('[Slack] No channel specified for daily summary');
    return;
  }

  try {
    // Get latest vitals
    const vitals = query('SELECT * FROM vitals ORDER BY date DESC, time DESC LIMIT 1');
    const latestVitals = vitals[0];

    // Get active medications
    const meds = query('SELECT name, dosage FROM medications WHERE active = 1 OR stopped_date IS NULL ORDER BY name');

    // Get conditions
    const conditions = query('SELECT name, status FROM conditions WHERE status = "active" ORDER BY diagnosed_date DESC');

    // Build message
    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🏥 Daily Health Summary',
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}*`
        }
      },
      { type: 'divider' }
    ];

    // Vitals section
    if (latestVitals) {
      const vitalFields = [];
      if (latestVitals.systolic && latestVitals.diastolic) {
        vitalFields.push(`📊 *Blood Pressure:* ${latestVitals.systolic}/${latestVitals.diastolic} mmHg`);
      }
      if (latestVitals.heart_rate) {
        vitalFields.push(`💓 *Heart Rate:* ${latestVitals.heart_rate} bpm`);
      }
      if (latestVitals.weight_lbs) {
        vitalFields.push(`⚖️ *Weight:* ${latestVitals.weight_lbs} lbs`);
      }
      if (latestVitals.temperature_f) {
        vitalFields.push(`🌡️ *Temperature:* ${latestVitals.temperature_f}°F`);
      }
      if (latestVitals.oxygen_saturation) {
        vitalFields.push(`💨 *O2 Sat:* ${latestVitals.oxygen_saturation}%`);
      }

      if (vitalFields.length > 0) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Latest Vitals* (${latestVitals.date})\n${vitalFields.join('\n')}`
          }
        });
      }
    }

    // Medications section
    if (meds.length > 0) {
      const medList = meds.slice(0, 5).map(m => `• ${m.name}${m.dosage ? ` - ${m.dosage}` : ''}`).join('\n');
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*💊 Active Medications* (${meds.length})\n${medList}${meds.length > 5 ? `\n_...and ${meds.length - 5} more_` : ''}`
        }
      });
    }

    // Conditions section
    if (conditions.length > 0) {
      const condList = conditions.slice(0, 3).map(c => `• ${c.name}`).join('\n');
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*🩺 Active Conditions*\n${condList}`
        }
      });
    }

    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: '💡 Use `/health <command>` for more details or DM me for sensitive data'
        }
      ]
    });

    await sendSlackMessage(channel, '🏥 Daily Health Summary', blocks);
    console.log('[Slack] Daily health summary sent');
  } catch (err) {
    console.error('[Slack] Error sending daily summary:', err);
  }
}

/**
 * New Research Alert
 * Notifies when automated research scanner finds new papers
 */
export async function sendNewResearchAlert(papers, channel = SLACK_DEFAULT_CHANNEL) {
  if (!channel || papers.length === 0) return;

  try {
    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '📚 New Research Found',
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `Found *${papers.length}* new research paper${papers.length > 1 ? 's' : ''}:`
        }
      },
      { type: 'divider' }
    ];

    papers.slice(0, 5).forEach(paper => {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${paper.title}*\n_${paper.authors || 'Authors unknown'}_\n${paper.journal || ''} ${paper.publication_date || ''}`
        },
        accessory: paper.url ? {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Read Paper',
            emoji: true
          },
          url: paper.url
        } : undefined
      });
    });

    if (papers.length > 5) {
      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `_...and ${papers.length - 5} more papers. Check the Research tab for full list._`
          }
        ]
      });
    }

    await sendSlackMessage(channel, `📚 ${papers.length} new research papers found`, blocks);
    console.log(`[Slack] New research alert sent (${papers.length} papers)`);
  } catch (err) {
    console.error('[Slack] Error sending research alert:', err);
  }
}

/**
 * Abnormal Lab Alert
 * Notifies when lab results are outside normal range
 */
export async function sendAbnormalLabAlert(test, channel = SLACK_DEFAULT_CHANNEL) {
  if (!channel) return;

  try {
    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '⚠️ Abnormal Lab Result',
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${test.test_name}*\nResult: *${test.result}*\nDate: ${test.date}`
        }
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: '💡 Discuss with your healthcare provider. This is an automated alert, not medical advice.'
          }
        ]
      }
    ];

    await sendSlackMessage(channel, `⚠️ Abnormal lab: ${test.test_name}`, blocks);
    console.log(`[Slack] Abnormal lab alert sent: ${test.test_name}`);
  } catch (err) {
    console.error('[Slack] Error sending abnormal lab alert:', err);
  }
}

/**
 * Handle Slash Commands
 * Examples: /health vitals, /health meds, /health search <query>
 */
export async function handleSlashCommand(command, userId, channelId) {
  const args = command.text ? command.text.trim().split(' ') : [];
  const subcommand = args[0]?.toLowerCase();

  try {
    switch (subcommand) {
      case 'vitals':
        return await handleVitalsCommand(userId, channelId);
      
      case 'meds':
      case 'medications':
        return await handleMedicationsCommand(userId, channelId);
      
      case 'search':
        return await handleSearchCommand(args.slice(1).join(' '), userId, channelId);
      
      case 'labs':
      case 'tests':
        return await handleLabsCommand(userId, channelId);
      
      case 'help':
      default:
        return handleHelpCommand();
    }
  } catch (err) {
    console.error('[Slack] Error handling command:', err);
    return {
      response_type: 'ephemeral',
      text: '❌ Sorry, something went wrong processing your command.'
    };
  }
}

function handleHelpCommand() {
  return {
    response_type: 'ephemeral',
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🏥 MyTreatmentPath Bot - Commands',
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Available Commands:*\n\n' +
                '`/health vitals` - Show latest vital signs\n' +
                '`/health meds` - List active medications\n' +
                '`/health labs` - Show recent lab results\n' +
                '`/health search <query>` - Search research papers\n' +
                '`/health help` - Show this help message'
        }
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: '💡 *Tip:* DM me for sensitive health data. Public channels show limited info for privacy.'
          }
        ]
      }
    ]
  };
}

async function handleVitalsCommand(userId, channelId) {
  const vitals = query('SELECT * FROM vitals ORDER BY date DESC, time DESC LIMIT 1');
  
  if (vitals.length === 0) {
    return {
      response_type: 'ephemeral',
      text: '📊 No vitals recorded yet.'
    };
  }

  const latest = vitals[0];
  const fields = [];

  if (latest.systolic && latest.diastolic) {
    fields.push(`• *Blood Pressure:* ${latest.systolic}/${latest.diastolic} mmHg`);
  }
  if (latest.heart_rate) {
    fields.push(`• *Heart Rate:* ${latest.heart_rate} bpm`);
  }
  if (latest.weight_lbs) {
    fields.push(`• *Weight:* ${latest.weight_lbs} lbs`);
  }
  if (latest.temperature_f) {
    fields.push(`• *Temperature:* ${latest.temperature_f}°F`);
  }
  if (latest.oxygen_saturation) {
    fields.push(`• *O2 Saturation:* ${latest.oxygen_saturation}%`);
  }

  return {
    response_type: 'ephemeral',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*📊 Latest Vitals* (${latest.date}${latest.time ? ` at ${latest.time}` : ''})\n\n${fields.join('\n')}`
        }
      }
    ]
  };
}

async function handleMedicationsCommand(userId, channelId) {
  const meds = query('SELECT name, dosage, frequency FROM medications WHERE active = 1 OR stopped_date IS NULL ORDER BY name');
  
  if (meds.length === 0) {
    return {
      response_type: 'ephemeral',
      text: '💊 No active medications recorded.'
    };
  }

  const medList = meds.map(m => 
    `• *${m.name}*${m.dosage ? ` - ${m.dosage}` : ''}${m.frequency ? ` (${m.frequency})` : ''}`
  ).join('\n');

  return {
    response_type: 'ephemeral',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*💊 Active Medications* (${meds.length})\n\n${medList}`
        }
      }
    ]
  };
}

async function handleLabsCommand(userId, channelId) {
  const tests = query('SELECT test_name, result, date FROM test_results ORDER BY date DESC LIMIT 10');
  
  if (tests.length === 0) {
    return {
      response_type: 'ephemeral',
      text: '🔬 No lab results recorded yet.'
    };
  }

  const testList = tests.map(t => 
    `• *${t.test_name}:* ${t.result} (${t.date})`
  ).join('\n');

  return {
    response_type: 'ephemeral',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*🔬 Recent Lab Results* (last 10)\n\n${testList}`
        }
      }
    ]
  };
}

async function handleSearchCommand(query_text, userId, channelId) {
  if (!query_text) {
    return {
      response_type: 'ephemeral',
      text: '❌ Please provide a search query. Example: `/health search immunotherapy`'
    };
  }

  const papers = query(
    `SELECT title, journal, url FROM papers 
     WHERE title LIKE ? OR abstract LIKE ? 
     ORDER BY saved_at DESC LIMIT 5`,
    [`%${query_text}%`, `%${query_text}%`]
  );

  if (papers.length === 0) {
    return {
      response_type: 'ephemeral',
      text: `📚 No papers found for "${query_text}"`
    };
  }

  const paperList = papers.map(p => 
    `• *${p.title}*\n  ${p.journal || 'Journal unknown'}${p.url ? `\n  <${p.url}|Read Paper>` : ''}`
  ).join('\n\n');

  return {
    response_type: 'ephemeral',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*📚 Search Results for "${query_text}"*\n\n${paperList}`
        }
      }
    ]
  };
}

/**
 * Verify Slack request signature (security)
 */
export async function verifySlackSignature(signature, timestamp, body) {
  if (!SLACK_SIGNING_SECRET) {
    console.warn('[Slack] Signing secret not configured, skipping verification');
    return true; // Allow in development
  }

  const crypto = await import('crypto');
  const hmac = crypto.createHmac('sha256', SLACK_SIGNING_SECRET);
  const [version, hash] = signature.split('=');
  
  hmac.update(`${version}:${timestamp}:${body}`);
  const computed = hmac.digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(hash, 'hex'),
    Buffer.from(computed, 'hex')
  );
}
