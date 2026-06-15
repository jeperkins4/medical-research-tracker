# Phase 2: Cloud Integration Plan

## Overview
Add Supabase cloud services for non-PHI features while keeping all patient health data local.

**Timeline:** 4 weeks  
**Cost:** $0/month (free tier)

---

## Week 1: Authentication & User Accounts

### Day 1: Supabase Project Setup
```bash
# Install Supabase CLI
npm install --save-dev supabase

# Initialize Supabase
npx supabase init

# Start local Supabase (for development)
npx supabase start

# Install Supabase client
npm install @supabase/supabase-js
```

**Create Supabase project:**
1. Go to https://supabase.com
2. Create new project
3. Note: Project URL, anon key, service_role key
4. Add to `.env`:
   ```
   SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_ANON_KEY=eyJhbGciOi...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi... (backend only)
   ```

### Day 2-3: User Authentication

**Create `src/lib/supabase.js`:**
```javascript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

**Update Login.jsx:**
```javascript
// Option 1: Keep local auth (current system)
// Option 2: Migrate to Supabase auth
// Option 3: Hybrid - local auth + optional cloud sync

// Recommended: Hybrid approach
const handleLogin = async (username, password) => {
  // 1. Verify local credentials (existing bcrypt check)
  const localAuth = await verifyLocalCredentials(username, password);
  
  if (localAuth) {
    // 2. Optional: Sync to Supabase (for multi-device)
    if (navigator.onLine) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: username,
        password: password
      });
      
      if (!error) {
        localStorage.setItem('supabase_session', data.session.access_token);
      }
    }
    
    onLogin(username);
  }
};
```

**Database schema (Supabase):**
```sql
-- Create users table (extends Supabase auth.users)
CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ,
  subscription_tier TEXT DEFAULT 'free', -- free, pro, enterprise
  settings JSONB DEFAULT '{}'::jsonb
);

-- Row-level security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);
```

### Day 4-5: Settings Sync

**Create settings sync service:**
```javascript
// src/services/settings-sync.js
import { supabase } from '../lib/supabase';

export async function syncSettings(settings) {
  if (!navigator.onLine) return { synced: false };
  
  const { data, error } = await supabase
    .from('user_profiles')
    .update({ 
      settings: settings,
      last_login: new Date().toISOString()
    })
    .eq('id', supabase.auth.user().id);
  
  return { synced: !error, error };
}

export async function fetchSettings() {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('settings')
    .single();
  
  return data?.settings || {};
}
```

**What to sync (non-PHI only):**
```javascript
const syncableSettings = {
  theme: 'dark',
  notifications: true,
  researchPreferences: ['bladder cancer', 'FGFR3', 'immunotherapy'],
  // NO: patient name, DOB, medications, labs, vitals
};
```

---

## Week 2: Research Library Cloud Storage

### Day 6-7: Research Library Schema

```sql
-- Research papers (public data, user-specific saves)
CREATE TABLE research_library (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  authors TEXT,
  journal TEXT,
  publication_date DATE,
  abstract TEXT,
  pubmed_id TEXT,
  doi TEXT,
  url TEXT,
  cancer_types TEXT[], -- ['bladder', 'lung', etc.]
  mutations TEXT[], -- ['FGFR3', 'ARID1A', etc.]
  tags TEXT[],
  notes TEXT, -- user's personal notes
  saved_at TIMESTAMPTZ DEFAULT NOW(),
  last_accessed TIMESTAMPTZ
);

CREATE INDEX idx_research_user ON research_library(user_id);
CREATE INDEX idx_research_cancer ON research_library USING GIN(cancer_types);
CREATE INDEX idx_research_mutations ON research_library USING GIN(mutations);

-- RLS
ALTER TABLE research_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own research"
  ON research_library FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users manage own research"
  ON research_library FOR ALL
  USING (auth.uid() = user_id);
```

### Day 8-9: Research Sync Service

```javascript
// src/services/research-sync.js
import { supabase } from '../lib/supabase';

// Upload local research library to cloud
export async function syncResearchToCloud(localPapers) {
  const { data, error } = await supabase
    .from('research_library')
    .upsert(localPapers.map(paper => ({
      ...paper,
      user_id: supabase.auth.user().id
    })));
  
  return { success: !error, count: data?.length || 0 };
}

// Fetch research from cloud
export async function fetchCloudResearch() {
  const { data, error } = await supabase
    .from('research_library')
    .select('*')
    .order('saved_at', { ascending: false });
  
  return data || [];
}

// Merge local + cloud (conflict resolution)
export async function mergeResearch(local, cloud) {
  const merged = new Map();
  
  // Local papers take precedence (source of truth)
  local.forEach(paper => {
    merged.set(paper.pubmed_id || paper.id, paper);
  });
  
  // Add cloud papers not in local
  cloud.forEach(paper => {
    const key = paper.pubmed_id || paper.id;
    if (!merged.has(key)) {
      merged.set(key, paper);
    }
  });
  
  return Array.from(merged.values());
}
```

### Day 10: Research Discovery Edge Function

**Create Supabase Edge Function:**
```bash
npx supabase functions new research-scan
```

**File: `supabase/functions/research-scan/index.ts`**
```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
  
  // Get all users with research preferences
  const { data: users } = await supabase
    .from('user_profiles')
    .select('id, settings');
  
  for (const user of users) {
    const prefs = user.settings?.researchPreferences || [];
    
    // Search PubMed for each preference
    for (const term of prefs) {
      const pubmedUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(term)}&retmode=json&retmax=10&sort=date`;
      
      const response = await fetch(pubmedUrl);
      const data = await response.json();
      
      // Process results, save to research_library
      // ...
    }
  }
  
  return new Response(JSON.stringify({ scanned: users.length }), {
    headers: { 'Content-Type': 'application/json' }
  });
});
```

**Schedule daily:**
```sql
-- Supabase cron extension
SELECT cron.schedule(
  'research-scan-daily',
  '0 2 * * *', -- 2 AM daily
  $$
  SELECT net.http_post(
    url:='https://xxxxx.supabase.co/functions/v1/research-scan',
    headers:='{"Authorization": "Bearer SERVICE_ROLE_KEY"}'::jsonb
  ) AS request_id;
  $$
);
```

---

## Week 3: Encrypted Backup/Restore

### Day 11-12: Backup Metadata Schema

```sql
CREATE TABLE backup_metadata (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  backup_path TEXT NOT NULL, -- Supabase Storage path
  created_at TIMESTAMPTZ DEFAULT NOW(),
  size_bytes BIGINT,
  encrypted BOOLEAN DEFAULT true,
  device_name TEXT, -- "John's MacBook Pro"
  app_version TEXT, -- "0.1.0"
  database_version INTEGER -- For migration tracking
);

CREATE INDEX idx_backup_user ON backup_metadata(user_id, created_at DESC);

ALTER TABLE backup_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own backups"
  ON backup_metadata FOR SELECT
  USING (auth.uid() = user_id);
```

### Day 13-14: Backup Service

```javascript
// src/services/cloud-backup.js
import { supabase } from '../lib/supabase';
import { createCipheriv, randomBytes, pbkdf2Sync } from 'crypto';

export async function createCloudBackup(password) {
  // 1. Export local database
  const db = await exportDatabase(); // Your existing export
  
  // 2. Encrypt with user password (client-side)
  const salt = randomBytes(16);
  const key = pbkdf2Sync(password, salt, 100000, 32, 'sha256');
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  
  const encrypted = Buffer.concat([
    salt,
    iv,
    cipher.update(db),
    cipher.final(),
    cipher.getAuthTag()
  ]);
  
  // 3. Upload to Supabase Storage (encrypted blob)
  const filename = `backup-${Date.now()}.enc`;
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('backups')
    .upload(`${supabase.auth.user().id}/${filename}`, encrypted);
  
  if (uploadError) throw uploadError;
  
  // 4. Save metadata
  const { data: metadata, error: metaError } = await supabase
    .from('backup_metadata')
    .insert({
      user_id: supabase.auth.user().id,
      backup_path: uploadData.path,
      size_bytes: encrypted.length,
      device_name: await getDeviceName(),
      app_version: app.getVersion()
    });
  
  return { success: true, backupId: metadata.id };
}

export async function restoreFromCloud(backupId, password) {
  // 1. Get metadata
  const { data: meta } = await supabase
    .from('backup_metadata')
    .select('backup_path')
    .eq('id', backupId)
    .single();
  
  // 2. Download encrypted blob
  const { data: blob } = await supabase.storage
    .from('backups')
    .download(meta.backup_path);
  
  // 3. Decrypt
  const buffer = await blob.arrayBuffer();
  const data = new Uint8Array(buffer);
  
  const salt = data.slice(0, 16);
  const iv = data.slice(16, 32);
  const encrypted = data.slice(32, -16);
  const authTag = data.slice(-16);
  
  const key = pbkdf2Sync(password, salt, 100000, 32, 'sha256');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ]);
  
  // 4. Import database
  await importDatabase(decrypted);
  
  return { success: true };
}
```

### Day 15: Backup UI

**Add to Electron app:**
```javascript
// Settings → Backups panel
<div className="backup-panel">
  <h3>Cloud Backup</h3>
  
  <button onClick={handleCloudBackup}>
    ☁️ Backup to Cloud
  </button>
  
  <div className="backup-list">
    {cloudBackups.map(backup => (
      <div key={backup.id} className="backup-item">
        <span>{new Date(backup.created_at).toLocaleString()}</span>
        <span>{(backup.size_bytes / 1024 / 1024).toFixed(2)} MB</span>
        <span>{backup.device_name}</span>
        <button onClick={() => handleRestore(backup.id)}>
          Restore
        </button>
      </div>
    ))}
  </div>
</div>
```

---

## Week 4: Auto-Update + Polish

### Day 16-17: Auto-Update System

**Install electron-updater:**
```bash
npm install electron-updater
```

**Update `electron/main.cjs`:**
```javascript
const { autoUpdater } = require('electron-updater');

// Configure auto-updater
autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'mytreatmentpath',
  repo: 'mytreatmentpath-electron',
  private: false
});

// Check for updates on startup
app.on('ready', () => {
  // Wait 10 seconds after app starts
  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify();
  }, 10000);
});

autoUpdater.on('update-available', (info) => {
  dialog.showMessageBox({
    type: 'info',
    title: 'Update Available',
    message: `Version ${info.version} is available. Download now?`,
    buttons: ['Download', 'Later']
  }).then(result => {
    if (result.response === 0) {
      autoUpdater.downloadUpdate();
    }
  });
});

autoUpdater.on('update-downloaded', (info) => {
  dialog.showMessageBox({
    type: 'info',
    title: 'Update Ready',
    message: 'Update downloaded. Restart to install?',
    buttons: ['Restart', 'Later']
  }).then(result => {
    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
});
```

**Update `electron-builder.yml`:**
```yaml
publish:
  provider: github
  owner: mytreatmentpath
  repo: mytreatmentpath-electron
  releaseType: release # or 'draft'
```

**Create GitHub release:**
```bash
# Build for all platforms
npm run electron:build:mac
npm run electron:build:win
npm run electron:build:linux

# electron-builder will auto-upload to GitHub Releases
# Set GITHUB_TOKEN environment variable
export GITHUB_TOKEN=ghp_xxxxx

npm run electron:build -- --publish always
```

### Day 18-19: Sync Coordination

**Create sync manager:**
```javascript
// src/services/sync-manager.js
class SyncManager {
  constructor() {
    this.syncInterval = null;
    this.lastSync = null;
  }
  
  async start() {
    // Sync on app start
    await this.performSync();
    
    // Sync every 5 minutes (if online)
    this.syncInterval = setInterval(async () => {
      if (navigator.onLine) {
        await this.performSync();
      }
    }, 5 * 60 * 1000);
  }
  
  async performSync() {
    try {
      // 1. Sync settings
      const settings = getLocalSettings();
      await syncSettings(settings);
      
      // 2. Sync research library
      const localPapers = getLocalResearchLibrary();
      await syncResearchToCloud(localPapers);
      
      // 3. Check for cloud updates
      const cloudPapers = await fetchCloudResearch();
      const merged = await mergeResearch(localPapers, cloudPapers);
      await saveLocalResearchLibrary(merged);
      
      this.lastSync = new Date();
      console.log('[Sync] Complete:', this.lastSync);
    } catch (error) {
      console.error('[Sync] Failed:', error);
    }
  }
  
  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
  }
}

export const syncManager = new SyncManager();
```

### Day 20: Testing & Documentation

**Test checklist:**
- [ ] Sign up new user (Supabase)
- [ ] Login existing user
- [ ] Settings sync (change theme, verify on second device)
- [ ] Research sync (save paper, verify on cloud)
- [ ] Cloud backup (create, download, restore)
- [ ] Auto-update (create release, verify download)
- [ ] Offline mode (disconnect internet, verify app works)
- [ ] Online sync (reconnect, verify sync)

**Documentation:**
```markdown
# Cloud Features User Guide

## Cloud Sync
Your app settings and research library automatically sync across devices.

**What syncs:**
- App theme and preferences
- Research papers you've saved
- Search preferences

**What stays local:**
- All your health data (labs, vitals, medications)
- Genomic information
- Provider notes

## Cloud Backup
Create encrypted backups stored in the cloud.

**To backup:**
1. Settings → Backups
2. Click "Backup to Cloud"
3. Enter your master password
4. Backup uploads (encrypted)

**To restore:**
1. Settings → Backups
2. Select backup
3. Click "Restore"
4. Enter your master password

**Security:** Backups are encrypted on your device before upload. The cloud cannot decrypt them without your password.
```

---

## Architecture Decisions

### Decision 1: Auth Strategy

**Option A: Supabase Auth Only**
- ✅ Simple, one system
- ✅ Multi-device by default
- ⚠️ Requires internet for first login
- ⚠️ Migration needed from current local auth

**Option B: Local Auth + Optional Supabase**
- ✅ Works offline always
- ✅ No migration needed
- ✅ Cloud sync is opt-in
- ⚠️ More complex (two auth systems)

**Option C: Hybrid (Local Primary + Cloud Sync)**
- ✅ Best of both worlds
- ✅ Offline-first, cloud-enhanced
- ⚠️ Most complex to implement

**Recommendation:** Option C (Hybrid)

### Decision 2: Data Sync Strategy

**Option A: Full Sync (All Data)**
- Upload everything to cloud
- ❌ Violates PHI-local principle

**Option B: Selective Sync (Non-PHI Only)**
- Only settings + research library
- ✅ Maintains privacy
- ✅ Simple mental model

**Option C: Encrypted Sync (Everything Encrypted)**
- Upload encrypted PHI to cloud
- ✅ Full feature set
- ⚠️ Cloud has encrypted PHI (still HIPAA?)
- ⚠️ Complex key management

**Recommendation:** Option B (Selective Sync)

### Decision 3: Backup Strategy

**Option A: Local Only**
- Current state
- ⚠️ Users lose data if device dies

**Option B: Cloud Encrypted**
- User password encrypts before upload
- ✅ Disaster recovery
- ✅ Cloud can't decrypt

**Option C: User's Own Cloud**
- User configures their AWS/GCP
- ✅ Full control
- ⚠️ Complex setup

**Recommendation:** Option B (Cloud Encrypted) + Option C (future)

---

## Security Checklist

### Data Classification

**PHI (Always Local):**
- ❌ Patient name, DOB
- ❌ Lab results, vitals
- ❌ Medications, dosages
- ❌ Genomic mutations (with patient ID)
- ❌ Provider notes
- ❌ Portal credentials (even encrypted)

**Non-PHI (Cloud OK):**
- ✅ User email (for auth)
- ✅ App settings (theme, notifications)
- ✅ Research preferences (cancer type, keywords)
- ✅ Saved research papers (public data)
- ✅ Encrypted backup blobs (can't decrypt)

### Encryption Requirements

**At Rest:**
- Local: SQLCipher AES-256 (✅ done)
- Cloud: Supabase default encryption (PostgreSQL + Storage)

**In Transit:**
- HTTPS/TLS 1.3 for all Supabase API calls (✅ automatic)

**Client-Side:**
- Backups encrypted before upload (user password)
- Cloud never sees plaintext PHI

### Access Control

**Local Database:**
- Password required (✅ done)
- Session timeout (15 min idle)

**Cloud Database:**
- Row-level security (RLS)
- Users can only access their own data
- Service role key on backend only (not in client)

---

## Cost Projection

### Year 1 (0-100 users)
- **Supabase:** $0/month (free tier)
- **Code signing:** $500/year (Apple + Windows)
- **GitHub:** $0 (public repo) or $4/month (private)
- **Total:** $500-550/year

### Year 2 (100-1000 users)
- **Supabase:** $25/month (Pro tier)
- **Code signing:** $500/year
- **GitHub:** $0
- **Total:** $800/year

### Year 3 (1000-10k users)
- **Supabase:** $25-100/month (Pro + add-ons)
- **Code signing:** $500/year
- **GitHub:** $0
- **CDN:** $20/month (Cloudflare)
- **Total:** $800-1700/year

**Break-even (if charging $9/month Pro tier):**
- 10 paid users = $90/month = $1080/year (covers costs)
- 100 paid users = $900/month = $10.8k/year (profitable)

---

## Next Steps

1. **Create Supabase project** (5 min)
2. **Run `npm install @supabase/supabase-js`** (1 min)
3. **Create `.env.local`** with Supabase keys (2 min)
4. **Implement auth integration** (Day 1-3)

Want me to start with Day 1 (Supabase setup)?
