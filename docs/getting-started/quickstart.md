# Quickstart Guide

**Get started with MyTreatmentPath in 5 minutes.**

---

## 1. Create Your Account (30 seconds)

When you first launch MyTreatmentPath:

1. **First-time setup:** Enter a username and password
2. Click **"Create Account"**
3. You're in! Your data is encrypted locally with AES-256.

**Multi-user?** If someone already set up the app, click **"Sign up"** to create your own account.

---

## 2. Complete Your Profile (2 minutes)

### Patient Information
1. Go to **Profile** → **Patient Info**
2. Fill in:
   - Name, DOB, sex, blood type
   - Height, weight
   - Allergies (important!)
   - Emergency contact
   - Primary physician
   - Insurance info

### Diagnosis & Treatment
1. Go to **Treatment** → **Medications**
2. Add your current medications:
   - Click **"+ Add Medication"**
   - Enter name, dosage, frequency
   - Select type (chemotherapy, immunotherapy, supplement, etc.)
   - Add notes (side effects, timing, etc.)

---

## 3. Add Genomic Data (Optional, 1 minute)

If you have genomic testing results (Foundation One, Tempus, Caris):

1. Go to **Genomics** → **Mutations**
2. Click **"+ Add Mutation"**
3. Enter gene name (e.g., `FGFR3`, `ARID1A`, `PIK3CA`)
4. Select variant type
5. Add clinical significance

**Why?** The system recommends targeted therapies based on your mutations.

---

## 4. Discover Research (1 minute)

### Manual Search
1. Go to **Research** → **Search**
2. Enter: `bladder cancer FGFR3 inhibitor` (or your cancer type + mutation)
3. Browse results from PubMed
4. Click **"Save to Library"** on relevant papers

### Automated Scanner (Set & Forget)
1. Settings (coming soon) → **Research Preferences**
2. Add search terms:
   - Your cancer type
   - Your mutations
   - Treatment types you're exploring
3. Scanner runs daily at 2 AM
4. New papers appear in **Research** → **Library**

---

## 5. Track Your Health (Ongoing)

### Vitals
1. **Profile** → **Vitals & Records**
2. Click **"+ Add Vital"**
3. Record:
   - Weight, blood pressure, temperature
   - Pain levels (1-10 scale)
   - Symptoms (nausea, fatigue, etc.)
   - Energy levels

### Lab Results
1. **Profile** → **Lab Results**
2. Upload or manually enter:
   - CBC (complete blood count)
   - CMP (metabolic panel)
   - Tumor markers (PSA, CA 19-9, etc.)
   - Kidney/liver function
3. System auto-detects abnormal values

### Nutrition
1. **Treatment** → **Nutrition**
2. Click **"+ Analyze Meal"**
3. Describe what you ate (or snap a photo)
4. AI analyzes:
   - Nutrition facts (calories, protein, etc.)
   - Genomic compatibility (based on your mutations!)
   - Treatment interactions
   - Recommendations

---

## 6. Optional: Connect to Cloud

**Local-first:** All your health data stays encrypted on your device. Cloud sync is **optional** and only for research papers.

1. **Profile** → **Settings** → **Cloud Sync**
2. Click **"Connect to Cloud"**
3. Enter email + password
4. Your research library syncs to Supabase
5. Access from multiple devices

**What syncs:** Research papers, tags, preferences  
**What stays local:** Medications, labs, vitals, genomics (all PHI)

---

## 7. Explore Features

### 🧬 Precision Medicine
- View mutation-specific treatment options
- Browse clinical trials matching your profile
- See drug-gene interactions

### 📊 Analytics (Optional)
- Anonymized usage analytics
- Helps improve the app
- HIPAA Safe Harbor compliant (11+ user minimum)
- Opt-in only

### 🦴 Bone Health
- Track bone density (DEXA scans)
- Monitor calcium, vitamin D, phosphate
- Get alerts for osteoporosis risk factors

### 💊 Medication Evidence
- Click **"Evidence"** on any medication
- See peer-reviewed studies
- Understand why it's recommended for your mutations

---

## 8. Daily Workflow

**Morning:**
1. Log weight, vitals, symptoms (2 min)
2. Record breakfast in Nutrition Tracker (1 min)
3. Check for new research papers (1 min)

**After Doctor Visits:**
1. Add new lab results (5 min)
2. Update medications/dosages (2 min)
3. Add doctor's notes to patient profile (3 min)

**Weekly:**
1. Review trends in Analytics (5 min)
2. Backup database (automatic, but verify)

---

## Tips for Success

✅ **Be consistent:** Log vitals daily for meaningful trends  
✅ **Use tags:** Tag research papers by topic (trials, diet, supplements)  
✅ **Add context:** Notes fields are your friend — future you will thank you  
✅ **Backup regularly:** Encrypted backups run automatically at 2 AM  
✅ **Stay curious:** The research scanner finds papers you might miss  

---

## Need Help?

- **Installation issues?** See [Installation Guide](installation.md)
- **Cloud sync questions?** See [Cloud Sync](../features/cloud-sync.md)
- **API errors?** See [Troubleshooting](../development/troubleshooting.md)

---

**You're all set!** Start tracking your journey. 💙
