# System Architecture

**Technical overview of MyTreatmentPath's architecture.**

---

## Overview

MyTreatmentPath is a **local-first desktop application** built with Electron, React, and SQLite. Health data (PHI) stays encrypted on your device. Optional cloud sync for research papers (non-PHI) uses Supabase.

---

## Technology Stack

### Frontend
- **Framework:** React 18.3
- **Build tool:** Vite 5.4
- **State management:** React hooks (useState, useEffect)
- **Routing:** Single-page app (tab-based navigation)
- **Styling:** CSS modules + custom CSS

### Backend (API Server)
- **Runtime:** Node.js 25.5
- **Framework:** Express 4.21
- **Database:** SQLite 3 (encrypted)
- **Encryption:** better-sqlite3-multiple-ciphers (AES-256-CBC)
- **Authentication:** JWT (jsonwebtoken)
- **Password hashing:** bcrypt

### Desktop App
- **Platform:** Electron 34.0
- **Target:** macOS (Apple Silicon)
- **Packaging:** electron-builder
- **Code signing:** Apple Developer ID
- **Notarization:** @electron/notarize

### Cloud Services (Optional)
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth
- **Storage:** Supabase Storage (encrypted backups)
- **Website:** Vercel (static HTML)

### AI/ML
- **Provider:** Anthropic Claude
- **Models:**
  - Claude Sonnet 4.6 (meal analysis, genomic recommendations)
  - Claude Haiku 4.5 (lightweight tasks)
- **Use cases:**
  - Meal nutrition analysis
  - Genomic pathway recommendations
  - Research paper summaries

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│ ELECTRON APP (Desktop)                                   │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │ REACT FRONTEND (http://localhost:5173)         │    │
│  │ - Vite dev server                               │    │
│  │ - Component tree (App.jsx → views → components)│    │
│  │ - State management (React hooks)                │    │
│  └────────────────────────────────────────────────┘    │
│                       ↓ HTTP API calls                   │
│  ┌────────────────────────────────────────────────┐    │
│  │ EXPRESS API SERVER (http://localhost:3000)     │    │
│  │ - REST API endpoints                            │    │
│  │ - JWT authentication                            │    │
│  │ - Business logic                                │    │
│  └────────────────────────────────────────────────┘    │
│                       ↓ Database queries                 │
│  ┌────────────────────────────────────────────────┐    │
│  │ SQLITE DATABASE (encrypted)                     │    │
│  │ - AES-256-CBC encryption                        │    │
│  │ - 53 tables (PHI + non-PHI)                     │    │
│  │ - Stored: ~/medical-tracker.db                  │    │
│  └────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
                       ↓ Optional cloud sync
┌─────────────────────────────────────────────────────────┐
│ SUPABASE CLOUD (Optional)                               │
│  - PostgreSQL (research papers, user profiles)          │
│  - Supabase Auth (cloud accounts)                       │
│  - Storage (encrypted database backups)                 │
└─────────────────────────────────────────────────────────┘
```

---

## Data Flow

### Local-First (Offline)

```
User Input → React Component → API POST /api/medications
                                      ↓
                              Express handler validates
                                      ↓
                              SQLite INSERT (encrypted)
                                      ↓
                              Response { success: true }
                                      ↓
                              React updates UI
```

### Cloud Sync (Online, Optional)

```
User clicks "Sync Now" → React → POST /api/sync/research
                                         ↓
                                 Check Supabase credentials
                                         ↓
                                 Query local papers (unsynced)
                                         ↓
                                 For each paper:
                                   - Transform to Supabase schema
                                   - POST to Supabase API
                                   - Update local sync status
                                         ↓
                                 Response { synced: 8 }
                                         ↓
                                 React shows "Synced 8 papers"
```

---

## Database Schema

**53 tables, 4 categories:**

### 1. PHI Tables (NEVER synced)
- `patient_profile` - Patient demographics
- `conditions` - Diagnoses
- `medications` - Prescriptions, supplements
- `lab_results` - Blood tests, imaging
- `vitals` - Weight, BP, pain scores
- `genomic_mutations` - Foundation One data
- `meal_analyses` - Nutrition logs

### 2. User Management
- `users` - Local accounts (username, password_hash)
- `audit_log` - Authentication events
- `sync_log` - Cloud sync history

### 3. Research Library (Syncs to cloud)
- `papers` - PubMed articles
- `tags` - Paper categorization
- `paper_tags` - Many-to-many join

### 4. System Tables
- `backup_metadata` - Automated backup tracking
- `settings` - App preferences

**See:** [Database Schema Reference](database-schema.md)

---

## API Architecture

### REST API Endpoints

**Authentication:**
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - End session
- `GET /api/auth/check` - Verify token

**Cloud Sync:**
- `GET /api/sync/status` - Get sync status
- `POST /api/sync/connect` - Link to cloud
- `POST /api/sync/research` - Sync papers
- `POST /api/sync/full` - Full sync

**Medications:**
- `GET /api/medications` - List all
- `POST /api/medications` - Add new
- `PUT /api/medications/:id` - Update
- `DELETE /api/medications/:id` - Remove

**Research:**
- `GET /api/papers` - Library
- `POST /api/papers` - Save paper
- `DELETE /api/papers/:id` - Remove

**See:** [API Reference](api-reference.md)

---

## Security Architecture

### Layers of Protection

**1. Database Encryption (At Rest)**
- AES-256-CBC encryption
- Key stored in `.env` (local) or Keychain (future)

**2. Transport Security (In Transit)**
- HTTPS/TLS 1.3 (production)
- HTTP-only cookies (XSS protection)
- CORS policy (origin whitelisting)

**3. Authentication**
- JWT tokens (HMAC-SHA256)
- bcrypt password hashing (10 rounds)
- Session expiry (7 days)

**4. Authorization**
- User ID scoping (can only access own data)
- requireAuth middleware on all protected routes

**5. Audit Logging**
- All auth events logged
- IP address + user agent tracked

**See:** [Encryption](../security/encryption.md)

---

## Build Architecture

### Development

```bash
# Terminal 1: Frontend (React + Vite)
npm run dev
# → http://localhost:5173

# Terminal 2: Backend (Express API)
npm run server
# → http://localhost:3000

# Terminal 3: Electron (desktop shell)
npm run electron:dev
```

### Production Build

```bash
# 1. Build frontend (React → static assets)
npm run build
# → dist/index.html + assets

# 2. Package Electron app
npm run build:mac
# → build/MyTreatmentPath-0.1.1-arm64.dmg

# 3. Code sign + notarize
./build-notarized.sh
# → Signed, notarized .dmg
```

---

## File Structure

```
medical-research-tracker/
├── src/                      # React frontend
│   ├── App.jsx              # Main app component
│   ├── components/          # Reusable UI components
│   ├── pages/               # Full-page views (Terms, Privacy)
│   └── utils/               # Helpers (apiHelpers.js)
│
├── server/                   # Express backend
│   ├── index.js             # Main server file
│   ├── db-secure.js         # Encrypted SQLite wrapper
│   ├── auth.js              # JWT + bcrypt
│   ├── cloud-sync.js        # Supabase sync service
│   └── migrations/          # Database migrations
│
├── electron/                 # Electron shell
│   └── main.js              # Main process
│
├── website/                  # Public marketing site
│   ├── index.html           # Landing page
│   ├── privacy.html         # Privacy policy
│   └── terms.html           # Terms of use
│
├── docs/                     # Documentation (you are here)
│
└── build/                    # Electron build output
```

---

## State Management

### React State (Frontend)

**Component-level state:**
```jsx
const [medications, setMedications] = useState([]);
const [loading, setLoading] = useState(false);
```

**Global state (via props drilling):**
- Authenticated user
- Active tab
- Selected sub-tab

**No Redux/Zustand** - Simple useState for now

### Database State (Backend)

SQLite as single source of truth:
- No caching layer
- Direct queries on every API call
- Fast enough (<50ms queries)

---

## Performance Considerations

### Frontend
- **Lazy loading:** Components loaded on-demand
- **Virtualization:** Large lists (1000+ papers) use windowing
- **Debouncing:** Search input debounced (300ms)

### Backend
- **Indexed queries:** All foreign keys indexed
- **Connection pooling:** Single SQLite connection (better-sqlite3)
- **Query optimization:** Prepared statements

### Database
- **Vacuum:** Weekly VACUUM ANALYZE
- **File size:** ~5 MB (100 papers, 500 labs, 50 meds)
- **Backup compression:** gzip backups (5 MB → 1 MB)

---

## Error Handling

### Frontend

```jsx
try {
  const res = await fetch('/api/medications');
  const data = await res.json();
  setMedications(data);
} catch (err) {
  console.error('Failed to load medications:', err);
  setError('Connection error');
}
```

### Backend

```javascript
app.use((err, req, res, next) => {
  console.error('[Error]', err);
  res.status(500).json({ error: 'Internal server error' });
});
```

**Crash recovery:**
- Electron auto-restarts on crash
- Error logs: `logs/errors.log`
- Crash logs: `logs/crashes.log`

---

## Deployment Architecture

### Desktop App (Electron)

**Distribution:**
1. Build signed `.dmg` (macOS)
2. Upload to GitHub Releases
3. Users download from website

**Auto-updates:** Not yet implemented (planned v0.2.0)

### Website (Static)

**Hosting:** Vercel  
**Build:** None (static HTML)  
**Deploy:** Auto on git push  
**CDN:** Vercel Edge Network  

### Cloud Backend (Supabase)

**Database:** Managed PostgreSQL  
**Auth:** Supabase Auth API  
**Storage:** S3-compatible object storage  
**Scaling:** Auto-scales with usage  

---

## Future Architecture Plans

### v0.2.0
- [ ] **Keychain integration** - Store encryption keys securely
- [ ] **Auto-updates** - Electron auto-updater
- [ ] **Background sync** - Sync every 15 min when online

### v0.3.0
- [ ] **Mobile app** - React Native (iOS/Android)
- [ ] **Web app** - PWA for browser access
- [ ] **Multi-device sync** - Real-time data sync

### v1.0.0
- [ ] **Team collaboration** - Share research with care team
- [ ] **Provider portal** - Oncologist dashboard
- [ ] **FHIR integration** - Pull from Epic/Cerner

---

## Questions?

- **How to add a new API endpoint?** See [API Reference](api-reference.md)
- **How to add a database table?** See [Database Schema](database-schema.md)
- **How to contribute?** See [Contributing](contributing.md)
