## Enhanced Medication & Supplement Manager

**Complete system for tracking prescription drugs and supplements with research evidence**

---

## What's New

### 1. Enhanced Database Schema ✅
- **medications_enhanced** table with full medication tracking
- **medication_research** table for linking research articles
- **medication_log** table for dose tracking (adherence monitoring)
- **medication_combinations** table for tracking what's taken together

### 2. Medication Manager Component ✅
- Add/edit/delete medications and supplements
- Type filtering (prescription, supplement, OTC, integrative)
- Quick-add from evidence database (Curcumin, EGCG, Berberine, etc.)
- View research articles linked to each medication
- Auto-populate from medicationEvidence.js
- Beautiful modal for viewing evidence and research links

### 3. Backend API ✅
- Full CRUD operations for medications
- Research article management
- Dose tracking/logging
- Medication statistics (adherence rates)
- Search functionality

---

## Setup Instructions

### Step 1: Run Database Migration

```bash
cd /Users/perkins/.openclaw/workspace/medical-research-tracker

# Run migration to create enhanced tables
sqlite3 data/health-secure.db < server/migrations/011-enhanced-medications.sql
```

This will:
- Create `medications_enhanced` table (replaces old `medications`)
- Create `medication_research` table (for linking articles)
- Create `medication_log` table (for dose tracking)
- Migrate existing medication data to new schema

### Step 2: Update server/index.js

Add this import at the top with other imports:

```javascript
import { setupMedicationRoutes } from './medications-routes.js';
```

Then add this line after the database is initialized (around line 87, after `await init();`):

```javascript
// Setup enhanced medication routes
setupMedicationRoutes(app, requireAuth);
```

### Step 3: Update src/App.jsx

Add the import:

```javascript
import MedicationManager from './components/MedicationManager';
```

Add a new tab to the tabs array (around line 400):

```javascript
{ 
  id: 'medications', 
  label: '💊 Medications & Supplements', 
  icon: '💊',
  component: MedicationManager 
},
```

Add the render case in the renderTabContent function:

```javascript
case 'medications':
  return <MedicationManager apiFetch={apiFetch} />;
```

### Step 4: Restart the Server

```bash
# Kill existing server (Ctrl+C)
# Restart
npm run dev
```

---

## Usage

### Adding a Medication/Supplement

1. Click "💊 Medications & Supplements" tab
2. Click "+ Add Medication/Supplement" button
3. Fill out the form:
   - **Name**: Start typing and get autocomplete suggestions from evidence database
   - **Type**: Prescription, Supplement, OTC, or Integrative
   - **Dosage**: e.g., "500mg", "1 tablet"
   - **Frequency**: e.g., "Daily", "Twice daily"
   - **Started**: When you began taking it
   - **Reason**: Why taking it (e.g., "Target ARID1A mutation")
4. If the medication exists in the evidence database (like Curcumin, EGCG, Berberine), it will auto-populate:
   - Mechanism of action
   - Target pathways
   - Genomic alignment
   - Research articles (automatically added!)
   - Dosing recommendations
   - Precautions

### Quick Add (From Evidence Database)

For common supplements with research backing:
1. Click one of the "Quick Add" buttons (Curcumin, Green Tea Extract, etc.)
2. Form pre-fills with the name
3. Click "Add Medication" — research articles added automatically!

### Viewing Research Evidence

1. Click "📚 View Research" on any medication card
2. Modal shows:
   - Evidence strength
   - Target pathways
   - Genomic alignment (how it relates to your mutations)
   - All linked research articles with:
     - Title (clickable link to PubMed/journal)
     - Publication year
     - Key findings
     - Article type (supporting, warning, mechanism, clinical trial)

### Editing/Deleting

- Click "✏️ Edit" to modify any medication
- Click "🗑️ Delete" to remove (with confirmation)

### Filtering

Use the dropdown to filter by:
- All medications
- Prescriptions only
- Supplements only

---

## Features

### Auto-Population from Evidence Database

When you add a medication that exists in `medicationEvidence.js`, it automatically:
- Populates mechanism, pathways, genomic alignment
- Adds dosing recommendations and precautions
- **Links all research articles** (no manual work!)

Example: Adding "Curcumin" automatically adds 4 peer-reviewed studies with:
- Links to PubMed/journals
- Publication years
- Key findings

### Research Article Types

Articles are categorized as:
- **Supporting**: Evidence that supports using this medication
- **Warning**: Potential risks or contraindications
- **Mechanism**: How the medication works
- **Clinical Trial**: Clinical trial data
- **Review**: Review/meta-analysis

### Genomic Alignment

For patients with genomic data, shows how each medication targets specific mutations:
- **ARID1A mutation** → Curcumin (blocks HIF-1α pathway)
- **PIK3CA mutation** → EGCG (dual PI3K/mTOR inhibitor)
- **MDR phenotype** → Berberine (reverses P-glycoprotein resistance)

---

## Current Evidence Database

Pre-loaded medications with research:

### High Priority Supplements
1. **Curcumin** (4 studies) - Targets HIF-1α, ARID1A pathway
2. **Green Tea Extract/EGCG** (4 studies) - PI3K/mTOR inhibitor
3. **Berberine** (3 studies) - Reverses multi-drug resistance

### Additional Integrative Options
4. **Fenbendazole** (4 studies) - mTOR/AMPK pathway
5. **Ivermectin** (4 studies) - PI3K/mTOR inhibitor
6. **Low-Dose Naltrexone** (3 studies) - Immune modulation
7. **Vitamin C (High-Dose IV)** (4 studies) - Oxidative stress
8. **Methylene Blue** (3 studies) - Mitochondrial targeting
9. **AKG (Alpha-Ketoglutarate)** (3 studies) - mTOR inhibition
10. **Ubiquinol** (3 studies) - Mitochondrial support
11. **Salicinium** (1 study) - Glycolysis inhibitor

All with full citations, PubMed links, and mechanisms.

---

## Adding Custom Research Articles

To manually add a research article to a medication:

1. View the medication's research modal
2. Click "+ Add Research Article"
3. Fill in:
   - Title
   - URL (PubMed, journal, etc.)
   - Publication year
   - Key findings summary
   - Article type (supporting, warning, etc.)
   - Evidence quality (high, moderate, low)

---

## Database Schema

### medications_enhanced
```sql
- id (primary key)
- name, type, category
- dosage, frequency, route
- started_date, stopped_date, active
- reason, prescribed_by
- mechanism, target_pathways (JSON)
- genomic_alignment, evidence_strength
- recommended_dosing, precautions, interactions
- notes, effectiveness_rating
```

### medication_research
```sql
- id (primary key)
- medication_id (foreign key)
- title, authors, journal, publication_year
- abstract, url, pubmed_id, doi
- article_type, evidence_quality
- key_findings, relevance
```

### medication_log
```sql
- id (primary key)
- medication_id (foreign key)
- taken_date, taken_time
- dosage_taken, notes, missed
```

---

## API Endpoints

### Medications
- `GET /api/medications` - List all (with filters)
- `GET /api/medications/:id` - Get single medication
- `POST /api/medications` - Create new
- `PUT /api/medications/:id` - Update existing
- `DELETE /api/medications/:id` - Delete
- `GET /api/medications/search/:term` - Search
- `GET /api/medications/:id/stats` - Statistics (adherence, etc.)

### Research Articles
- `GET /api/medications/:id/research` - Get articles for medication
- `POST /api/medications/research` - Add article
- `DELETE /api/medications/research/:id` - Remove article

### Dose Logging
- `GET /api/medications/:id/log` - Get dose history
- `POST /api/medications/log` - Log dose taken

---

## Next Steps (Future Enhancements)

1. **Dose Tracking UI** - Daily checklist for adherence tracking
2. **Medication Calendar** - Visual calendar showing what to take when
3. **Interaction Checker** - Flag potential drug-drug or drug-supplement interactions
4. **Effectiveness Tracking** - Rate how well each medication is working over time
5. **Export Report** - Generate PDF summary for doctors
6. **Medication Reminders** - Push notifications for doses
7. **PubMed Integration** - Auto-search PubMed for new articles

---

## Troubleshooting

### "Failed to fetch medications"
- Check server console for errors
- Verify migration ran successfully: `sqlite3 data/health-secure.db "SELECT name FROM sqlite_master WHERE type='table' AND name='medications_enhanced';"`

### "Research articles not showing"
- Check that migration created `medication_research` table
- Verify medication has research linked: `sqlite3 data/health-secure.db "SELECT COUNT(*) FROM medication_research WHERE medication_id=1;"`

### "Auto-populate not working"
- Verify medication name matches exactly what's in `medicationEvidence.js`
- Case-sensitive: "Curcumin" not "curcumin"

---

**You now have a complete medication management system with research evidence integration!** 🎉

Add your mom's current medications and supplements, and the system will automatically link relevant research articles showing why they work for her specific genomic profile.
