# Syncthing Quick Start

## ✅ Mac Mini Setup (Done!)

**Status:** Running automatically on login
**Web UI:** http://localhost:8384
**Device ID:** `MU4NTZH-CJASSPV-SYK7EZT-2H7JRRS-SUVELDJ-DEPFQ7B-4HL4BG7-BMIBLQB`

---

## Next: Setup on Macbook

### 1. Install (on your Macbook)

```bash
brew install syncthing
brew services start syncthing
open http://localhost:8384
```

### 2. Add Mac Mini as Remote Device (on Macbook)

1. Web UI → **Add Remote Device**
2. **Device ID:** `MU4NTZH-CJASSPV-SYK7EZT-2H7JRRS-SUVELDJ-DEPFQ7B-4HL4BG7-BMIBLQB`
3. **Device Name:** "Mac Mini"
4. Click **Save**

### 3. Accept Connection on Mac Mini

1. Open http://localhost:8384 on Mac mini
2. You'll see popup: "New device wants to connect"
3. Click **Add Device**
4. Name it "Macbook"
5. Click **Save**

### 4. Add Folder to Sync (on BOTH devices)

**Path to sync:** `~/Library/Application Support/MyTreatmentPath`

**On Mac mini:**
1. Web UI → **Add Folder**
2. **Folder Path:** `~/Library/Application Support/MyTreatmentPath`
3. **Folder Label:** "MyTreatmentPath PHI"
4. **Sharing** tab → Check "Macbook"
5. **Save**

**On Macbook (repeat same steps):**
1. Add same folder
2. Share with "Mac Mini"

### 5. Test Sync

**On Mac mini:**
```bash
echo "sync test" > ~/Library/Application\ Support/MyTreatmentPath/test.txt
```

**On Macbook (wait 5-10 seconds):**
```bash
cat ~/Library/Application\ Support/MyTreatmentPath/test.txt
# Should show: "sync test"

# Clean up
rm ~/Library/Application\ Support/MyTreatmentPath/test.txt
```

**If you see "sync test" → IT WORKS!** 🎉

---

## Security (Recommended)

**Set GUI password (both devices):**
1. Web UI → **Actions** → **Settings** → **GUI**
2. **User:** admin
3. **Password:** (choose strong password)
4. **Save**

---

## Full Guide

See `SYNCTHING-SETUP.md` for complete documentation.

**You're syncing!** Any changes on one device appear on the other automatically.
