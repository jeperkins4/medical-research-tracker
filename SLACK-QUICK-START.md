# Slack Integration - Quick Start

## ⚡ 3-Minute Setup

### Step 1: Create Slack App (2 min)

1. Go to https://api.slack.com/apps → **Create New App** → **From scratch**
2. Name: `MyTreatmentPath Bot`, pick workspace
3. **OAuth & Permissions** → Add scopes:
   - `chat:write`, `chat:write.public`
   - `commands`, `app_mentions:read`
   - `channels:history`, `im:history`
4. **Install to Workspace** → **Copy bot token** (`xoxb-...`)
5. **Basic Information** → **Copy signing secret**

### Step 2: Configure Bot (1 min)

**Add to `.env`:**
```bash
SLACK_BOT_TOKEN=xoxb-your-token-here
SLACK_SIGNING_SECRET=your-secret-here
SLACK_CHANNEL_ID=C1234567890  # Optional
```

**Restart server:**
```bash
cd /Users/perkins/.openclaw/workspace/medical-research-tracker
node server/index.js
```

### Step 3: Set Up Commands (1 min)

**In Slack app settings:**

1. **Slash Commands** → Create `/health`:
   - Request URL: `https://YOUR_DOMAIN/api/slack/commands`
   - For local: Use ngrok (see below)

2. **Event Subscriptions** → Enable:
   - Request URL: `https://YOUR_DOMAIN/api/slack/events`
   - Subscribe to: `app_mention`, `message.im`

3. **Interactivity** → Enable:
   - Request URL: `https://YOUR_DOMAIN/api/slack/interactive`

---

## 🧪 Test It

In Slack:
```
/health vitals
```

You should see your latest vitals!

---

## 🌐 Local Testing (ngrok)

**If testing locally:**
```bash
brew install ngrok
ngrok http 3000
```

Copy the `https://abc123.ngrok.io` URL and use it in Slack app settings.

---

## 📚 What You Can Do

### Slash Commands
```
/health vitals          - Latest vitals
/health meds            - Active medications
/health labs            - Recent lab results
/health search <query>  - Search papers
```

### @Mentions
```
@MyTreatmentPath show my vitals
@MyTreatmentPath what medications am I on?
```

### DMs
Just ask naturally:
```
Show me my vitals
What medications am I taking?
Search for immunotherapy papers
```

### Automated Notifications
- **Daily summary:** 8 AM (configure in cron)
- **New research alerts:** When scanner finds papers
- **Abnormal lab alerts:** When results out of range

---

## 🔒 Privacy

✅ **Public channels:** Ephemeral messages (only you can see)  
✅ **DMs:** Full data access (1-on-1 encrypted)  
✅ **No PHI leaks:** HIPAA-safe messaging

---

## 📖 Full Guide

Read **SLACK-SETUP-GUIDE.md** for:
- Complete configuration steps
- Troubleshooting
- Advanced features
- Cron scheduling

---

## 💡 Quick Tips

**Get channel ID:**
Right-click channel → View details → Copy Channel ID

**Test manually:**
```bash
curl -X POST http://localhost:3000/api/slack/send-message \
  -H "Content-Type: application/json" \
  -d '{"channel": "C123", "text": "Test!"}'
```

**Check server logs:**
```bash
tail -f /path/to/server.log
```

---

**That's it!** 🎉 You now have a full Slack integration with interactive bot + automated notifications.
