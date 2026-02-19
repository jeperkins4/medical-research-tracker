# Slack Integration Setup Guide

## 🎯 What You Get

**Interactive Bot:**
- ✅ `/health vitals` - Show latest vitals
- ✅ `/health meds` - List active medications
- ✅ `/health labs` - Show recent lab results
- ✅ `/health search <query>` - Search research papers
- ✅ `@MyTreatmentPath <question>` - Natural language queries
- ✅ DM the bot for sensitive health data

**Automated Notifications:**
- ✅ Daily health summary (8 AM)
- ✅ New research alerts (when scanner finds papers)
- ✅ Abnormal lab alerts (when results out of range)

**HIPAA-Safe:**
- ✅ No PHI in public channels (uses ephemeral messages)
- ✅ Full data access via DMs only
- ✅ Request signature verification

---

## Step 1: Create Slack App (5 minutes)

### 1.1 Create App

1. Go to https://api.slack.com/apps
2. Click **"Create New App"**
3. Choose **"From scratch"**
4. App Name: `MyTreatmentPath Bot`
5. Pick your workspace
6. Click **"Create App"**

### 1.2 Configure Bot

**Go to "OAuth & Permissions" (left sidebar):**

Scroll to **"Bot Token Scopes"** and add:

```
chat:write              - Send messages
chat:write.public       - Post in public channels
commands                - Slash commands (/health)
app_mentions:read       - Respond to @mentions
channels:history        - Read channel messages (for context)
im:history              - Read DMs
```

**Scroll to top, click "Install to Workspace":**
- Authorize the app
- **Copy the "Bot User OAuth Token"** (starts with `xoxb-`)
- Save it for Step 2

### 1.3 Configure Slash Command

**Go to "Slash Commands" (left sidebar):**

1. Click **"Create New Command"**
2. Command: `/health`
3. Request URL: `https://YOUR_DOMAIN/api/slack/commands`
   - For local testing: Use ngrok (see below)
   - For production: Use your server URL
4. Short Description: `Access your health data and research`
5. Usage Hint: `vitals | meds | labs | search <query> | help`
6. Click **"Save"**

### 1.4 Enable Event Subscriptions

**Go to "Event Subscriptions" (left sidebar):**

1. Toggle **"Enable Events"** to ON
2. Request URL: `https://YOUR_DOMAIN/api/slack/events`
   - Slack will verify the URL (should show green checkmark)
3. **Subscribe to Bot Events:**
   - `app_mention` - When someone @mentions the bot
   - `message.im` - When someone DMs the bot
4. Click **"Save Changes"**

### 1.5 Enable Interactivity

**Go to "Interactivity & Shortcuts" (left sidebar):**

1. Toggle **"Interactivity"** to ON
2. Request URL: `https://YOUR_DOMAIN/api/slack/interactive`
3. Click **"Save Changes"**

### 1.6 Get Signing Secret

**Go to "Basic Information" (left sidebar):**

Under **"App Credentials"**, find:
- **Signing Secret** (click "Show" to reveal)
- Copy this for Step 2

---

## Step 2: Configure Environment Variables

Add to `/Users/perkins/.openclaw/workspace/medical-research-tracker/.env`:

```bash
# Slack Integration
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
SLACK_SIGNING_SECRET=your-signing-secret-here
SLACK_CHANNEL_ID=C1234567890  # Optional: default channel for notifications
```

**To get your channel ID:**
1. Open Slack
2. Right-click the channel → "View channel details"
3. Scroll to bottom → Copy "Channel ID"

---

## Step 3: Local Testing with ngrok (Optional)

If testing locally before deploying to production:

### 3.1 Install ngrok

```bash
brew install ngrok
```

### 3.2 Create Tunnel

```bash
ngrok http 3000
```

You'll see output like:
```
Forwarding   https://abc123.ngrok.io -> http://localhost:3000
```

### 3.3 Update Slack URLs

Go back to Slack app settings and update:
- **Slash Commands** Request URL: `https://abc123.ngrok.io/api/slack/commands`
- **Event Subscriptions** Request URL: `https://abc123.ngrok.io/api/slack/events`
- **Interactivity** Request URL: `https://abc123.ngrok.io/api/slack/interactive`

**Note:** ngrok URLs change each restart. For persistent URL, use `ngrok http --domain=your-subdomain.ngrok.io 3000` (requires paid plan).

---

## Step 4: Start the Server

```bash
cd /Users/perkins/.openclaw/workspace/medical-research-tracker

# Start backend (if not already running)
node server/index.js

# Or use npm script
npm run server
```

You should see:
```
✅ Slack routes configured
🏥 Medical Research Tracker API running on http://0.0.0.0:3000
```

---

## Step 5: Test the Integration

### 5.1 Test Slash Command

In any Slack channel or DM:
```
/health help
```

You should see:
```
🏥 MyTreatmentPath Bot - Commands

Available Commands:

/health vitals - Show latest vital signs
/health meds - List active medications
/health labs - Show recent lab results
/health search <query> - Search research papers
/health help - Show this help message

💡 Tip: DM me for sensitive health data. Public channels show limited info for privacy.
```

### 5.2 Test @Mention

In a channel:
```
@MyTreatmentPath show my vitals
```

You should get an ephemeral message (only you can see) with your vitals.

### 5.3 Test DM

Open DM with the bot:
```
Show me my medications
```

You should get a full list of active medications.

### 5.4 Test Daily Summary (Manual)

```bash
curl -X POST http://localhost:3000/api/slack/send-daily-summary \
  -H "Content-Type: application/json" \
  -d '{"channel": "YOUR_CHANNEL_ID"}'
```

Or use Postman/Insomnia with:
- URL: `http://localhost:3000/api/slack/send-daily-summary`
- Method: POST
- Body: `{"channel": "C1234567890"}`

---

## Step 6: Schedule Notifications

### Option A: Cron Job (Linux/Mac)

Add to crontab:
```bash
crontab -e
```

Add line:
```
0 8 * * * curl -X POST http://localhost:3000/api/slack/send-daily-summary -H "Content-Type: application/json" -d '{"channel": "YOUR_CHANNEL_ID"}'
```

### Option B: Node-Cron (Recommended)

Already integrated! The server will automatically send daily summaries at 8 AM if you enable it in server/index.js.

See `server/index.js` for scheduling configuration.

---

## Command Reference

### Slash Commands

```
/health vitals          - Latest vital signs (BP, HR, temp, weight, O2)
/health meds            - Active medications with dosages
/health labs            - Recent lab results (last 10)
/health search <query>  - Search research papers
/health help            - Show help message
```

### @Mentions (Natural Language)

```
@MyTreatmentPath show my vitals
@MyTreatmentPath what medications am I on?
@MyTreatmentPath search for immunotherapy papers
@MyTreatmentPath help
```

### DM Commands (Most Permissive)

Just ask naturally:
```
Show me my vitals
What medications am I taking?
Show recent lab results
Search for nectin-4 research
```

---

## Privacy & Security

### ✅ What's Safe

- Research paper searches (no PHI)
- Generic commands in public channels
- All data in DMs

### ⚠️ HIPAA Compliance

**Public Channels:**
- Bot uses **ephemeral messages** (only you can see)
- No PHI visible to other users
- Safe for general health tracking

**Direct Messages:**
- Full access to health data
- PHI allowed (1-on-1 encrypted by Slack)
- Recommended for sensitive queries

**Best Practice:**
- Use DMs for detailed health queries
- Use public channels for research/general info
- Use ephemeral messages for quick vitals checks

### 🔒 Request Verification

All incoming Slack requests are verified using:
- **Signing Secret** - Ensures request is from Slack
- **Timestamp Check** - Prevents replay attacks (5 min window)

If verification fails, request is rejected with 401.

---

## Troubleshooting

### "dispatch_failed" Error

**Cause:** Slack can't reach your server

**Fix:**
1. Check server is running: `curl http://localhost:3000/api/health`
2. If using ngrok, ensure tunnel is active
3. Update Slack URLs to match ngrok tunnel
4. Check firewall allows incoming HTTPS

### "Missing Bot Token"

**Cause:** `SLACK_BOT_TOKEN` not in `.env`

**Fix:**
1. Go to Slack app → OAuth & Permissions
2. Copy "Bot User OAuth Token"
3. Add to `.env`: `SLACK_BOT_TOKEN=xoxb-...`
4. Restart server

### "Invalid Signature"

**Cause:** `SLACK_SIGNING_SECRET` missing or wrong

**Fix:**
1. Go to Slack app → Basic Information
2. Copy "Signing Secret"
3. Add to `.env`: `SLACK_SIGNING_SECRET=abc123...`
4. Restart server

### Commands Work, But No Notifications

**Cause:** `SLACK_CHANNEL_ID` not set or wrong

**Fix:**
1. Right-click channel → View details
2. Copy Channel ID (bottom of modal)
3. Add to `.env`: `SLACK_CHANNEL_ID=C1234567890`
4. Test with `/api/slack/send-daily-summary` endpoint

### Bot Not Responding to @Mentions

**Cause:** Missing event subscription

**Fix:**
1. Go to Event Subscriptions
2. Ensure `app_mention` is in "Subscribe to bot events"
3. Save changes
4. Reinstall app to workspace

---

## Advanced Features

### Custom Notifications

Send custom alerts from your code:

```javascript
import { sendSlackMessage } from './server/slack-integration.js';

await sendSlackMessage('C1234567890', 'Custom alert!', [
  {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: '*Custom Alert*\nSomething important happened!'
    }
  }
]);
```

### Research Scanner Integration

When automated scanner finds new papers:

```javascript
import { sendNewResearchAlert } from './server/slack-integration.js';

const newPapers = [
  { title: 'Paper 1', authors: 'Smith et al', journal: 'Nature', url: 'https://...' },
  { title: 'Paper 2', authors: 'Jones et al', journal: 'Science', url: 'https://...' }
];

await sendNewResearchAlert(newPapers, 'C1234567890');
```

### Lab Alert Integration

When abnormal lab result is added:

```javascript
import { sendAbnormalLabAlert } from './server/slack-integration.js';

const abnormalTest = {
  test_name: 'Alkaline Phosphatase',
  result: '215 U/L (HIGH)',
  date: '2026-02-18'
};

await sendAbnormalLabAlert(abnormalTest, 'C1234567890');
```

---

## Next Steps

1. ✅ Set up Slack app (Steps 1-2)
2. ✅ Test commands (Step 5)
3. ✅ Schedule daily summaries (Step 6)
4. 📚 Integrate with research scanner (auto-alerts)
5. 🔔 Add lab result monitoring (abnormal alerts)
6. 📱 Add mobile shortcuts (Siri/Google Assistant → Slack commands)

---

**Need help?** Check server logs for detailed error messages:
```bash
tail -f /path/to/server.log
```

Or test endpoints directly:
```bash
curl -X POST http://localhost:3000/api/slack/send-message \
  -H "Content-Type: application/json" \
  -d '{"channel": "YOUR_CHANNEL_ID", "text": "Test message"}'
```
