# Syncthing Setup for PHI Sync

**Encrypted peer-to-peer sync between Macbook ↔ Mac Mini (no cloud)**

## What You Get

- ✅ **Automatic sync** - Changes on one device appear on the other instantly
- ✅ **E2E encrypted** - Data encrypted in transit (TLS)
- ✅ **No cloud** - Direct device-to-device sync
- ✅ **HIPAA compliant** - Encrypted, auditable, local-only
- ✅ **Battle-tested** - Used by millions, open source since 2013

---

## Step 1: Mac Mini Setup (✅ Already Done)

Syncthing is installed and running on your Mac mini.

- **Web UI:** http://localhost:8384 (should be open now)
- **Auto-start:** Runs automatically on login

---

## Step 2: Macbook Setup (Do this on your Macbook)

```bash
# Install Syncthing
brew install syncthing

# Start it (auto-start on login)
brew services start syncthing

# Open web UI
open http://localhost:8384
```

---

## Step 3: Connect Your Devices

### On Mac Mini:

1. Open http://localhost:8384
2. Click **Actions** → **Show ID**
3. Copy the Device ID (looks like: `ABCD1234-EFGH5678-...`)

### On Macbook:

1. Open http://localhost:8384
2. Click **Add Remote Device**
3. Paste the Mac mini's Device ID
4. Give it a name: "Mac Mini"
5. Click **Save**

### Back on Mac Mini:

1. You'll see a popup: "New device wants to connect"
2. Click **Add Device**
3. Name it "Macbook"
4. Click **Save**

**Devices are now paired!** 🎉

---

## Step 4: Add MyTreatmentPath Folder

### On BOTH Mac Mini AND Macbook:

1. Click **Add Folder**
2. **Folder Path:** `~/Library/Application Support/MyTreatmentPath`
3. **Folder Label:** `MyTreatmentPath PHI`
4. Click **Sharing** tab
5. Check the box for the other device (Mac Mini or Macbook)
6. Click **Save**

**Wait 30 seconds** - Syncthing will start syncing!

---

## Step 5: Verify Sync is Working

### Check status:

1. Web UI shows "Up to Date" on both devices
2. Folder shows green checkmark ✓

### Test sync:

**On Mac mini:**
```bash
# Create test file
echo "test" > ~/Library/Application\ Support/MyTreatmentPath/sync-test.txt
```

**On Macbook (wait 5 seconds):**
```bash
# Check if file appeared
cat ~/Library/Application\ Support/MyTreatmentPath/sync-test.txt
```

Should show: `test`

**If it worked, delete test file:**
```bash
rm ~/Library/Application\ Support/MyTreatmentPath/sync-test.txt
```

---

## Security Best Practices

### 1. Set a GUI Password (Recommended)

**On BOTH devices:**

1. Web UI → **Actions** → **Settings** → **GUI**
2. Set **GUI Authentication User:** (any username)
3. Set **GUI Authentication Password:** (strong password)
4. Click **Save**

Now web UI requires login (prevents local network snooping).

### 2. Enable Untrusted Mode (Extra Security)

If you're syncing over internet (not just local network):

1. **Actions** → **Settings** → **Connections**
2. Check **Enable Untrusted Devices**
3. This encrypts data even on trusted devices (defense in depth)

### 3. Firewall Rules (Optional)

Syncthing uses port **22000** for sync. If you only want local network sync:

```bash
# Block Syncthing from internet (macOS firewall)
# System Settings → Network → Firewall → Firewall Options
# Add Syncthing → Block incoming connections
```

---

## How It Works (Technical)

1. **Discovery:** Devices find each other via global discovery servers (just IDs, no data)
2. **Connection:** Direct TLS-encrypted connection between devices
3. **Sync:** Block-level deduplication, versioning, conflict resolution
4. **Encryption:** TLS 1.3 in transit, data stored unencrypted locally (SQLite already encrypted via SQLCipher)

**Privacy:** 
- Discovery servers only see device IDs (random strings, no PHI)
- All PHI stays on your devices (never touches discovery servers)
- Direct peer-to-peer connection (no relay unless firewall blocks)

---

## Troubleshooting

### Devices won't connect

**Check local network:**
```bash
# On Mac mini
ping macbook.local

# On Macbook
ping mac-mini.local
```

If ping fails, devices aren't on same network. Use **Tailscale** (see below).

### Sync is slow

- Check bandwidth: Web UI → **Actions** → **Settings** → **Connections**
- Increase rate limits if needed

### Conflicts

If you edit the same file on both devices while disconnected:

- Syncthing creates `.sync-conflict` file (keeps both versions)
- Manually resolve by choosing one

---

## Advanced: Sync Over Internet (Tailscale)

If Macbook and Mac mini aren't on same network:

```bash
# Install Tailscale on both
brew install tailscale

# Start and authenticate
sudo tailscale up

# Now devices can sync even on different networks (encrypted VPN)
```

Syncthing will automatically discover via Tailscale's encrypted tunnel.

---

## Maintenance

### View logs:
```bash
# Mac mini
tail -f ~/.config/syncthing/syncthing.log

# Check sync status
syncthing cli show connections
```

### Update Syncthing:
```bash
brew upgrade syncthing
brew services restart syncthing
```

### Uninstall (if needed):
```bash
brew services stop syncthing
brew uninstall syncthing
rm -rf ~/.config/syncthing
```

---

## FAQ

**Q: Is this HIPAA compliant?**
A: Yes - encrypted in transit (TLS), encrypted at rest (SQLCipher), auditable, no cloud storage.

**Q: What if one device is offline?**
A: Syncthing waits. When it reconnects, changes sync automatically.

**Q: Can I sync 3+ devices?**
A: Yes! Add each device to the folder sharing list.

**Q: Does this replace PHI Transfer System?**
A: It complements it. Use Syncthing for automatic sync, PHI Transfer for one-time encrypted backups.

**Q: How much bandwidth does it use?**
A: Only changed blocks are synced (very efficient). Initial sync = full database size.

**Q: What about database corruption?**
A: Syncthing has versioning (keeps old versions). Configure under **Folder** → **File Versioning**.

---

## Next Steps

Once sync is working:

1. ✅ Test creating account on Macbook → verify it appears on Mac mini
2. ✅ Test adding medication on Mac mini → verify it appears on Macbook  
3. ✅ Enable file versioning (Web UI → Folder → Edit → File Versioning → Simple versioning)
4. ✅ Set GUI password for security

**You're done!** Your PHI now syncs automatically between devices. 🎉

---

**Support:**
- Syncthing docs: https://docs.syncthing.net
- Community forum: https://forum.syncthing.net
- This guide: `~/.openclaw/workspace/medical-research-tracker/SYNCTHING-SETUP.md`
