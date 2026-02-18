# FHIR Integration Quick Start

## What is FHIR?

**FHIR (Fast Healthcare Interoperability Resources)** is the standard way healthcare apps access patient data from EHR systems like Epic, Cerner, and others.

**SMART on FHIR** is the authentication protocol (based on OAuth 2.0) that lets patients authorize apps to access their health records.

## Why Use FHIR Instead of Browser Automation?

| Feature | FHIR API | Browser Automation |
|---------|----------|-------------------|
| **Speed** | ⚡ Fast (seconds) | 🐌 Slow (30-60 seconds) |
| **Reliability** | ✅ Structured data | ⚠️ Breaks when portal UI changes |
| **Data Quality** | ✅ Coded (LOINC, SNOMED) | ❌ Unstructured text |
| **Auth** | 🔐 OAuth (secure) | 🔑 Username/password |
| **Maintenance** | ✅ Stable API | ❌ Requires updates when UI changes |

**Bottom line:** FHIR is faster, more reliable, and gives you better data.

## Setup (5 minutes)

### Step 1: Register Your App with Epic

1. **Go to:** https://fhir.epic.com/Developer/Apps
2. **Create Account** (free, instant approval for non-production apps)
3. **Click:** "Build Apps" → "Create"
4. **Fill out:**
   - **App Name:** MyTreatmentPath
   - **Application Type:** Patient Standalone
   - **FHIR Version:** R4
   - **Redirect URI:** `http://localhost:3000/api/fhir/callback`
   - **Requested Scopes:**
     ```
     patient/Observation.read
     patient/DiagnosticReport.read
     patient/DocumentReference.read
     patient/MedicationRequest.read
     patient/Condition.read
     patient/Patient.read
     launch/patient
     offline_access
     ```
5. **Save** and copy your **Client ID**

### Step 2: Add Client ID to Environment

Edit `.env` file:

```bash
EPIC_CLIENT_ID=your_client_id_here
```

### Step 3: Run Database Migration

The FHIR OAuth tables need to be created:

```bash
cd ~/.openclaw/workspace/medical-research-tracker
sqlite3 data/health.db < server/migrations/010-add-fhir-oauth.sql
```

### Step 4: Restart the Server

```bash
# If running in dev mode:
npm run start

# Or restart your Electron app
```

## How to Use

### First Time: Connect Epic MyChart

1. **Open MyTreatmentPath**
2. **Go to:** 🔐 Portals tab
3. **Add New Credential:**
   - Service Name: "My Epic MyChart"
   - Portal Type: **Epic MyChart (FHIR)**
   - URL: (leave blank for FHIR)
4. **Click:** "Connect Epic MyChart"
5. **You'll be redirected to Epic login**
6. **Login** with your Epic MyChart credentials
7. **Approve** the requested permissions
8. **You'll be redirected back** to MyTreatmentPath

### Sync Your Data

Once connected, click **"🔄 Sync Now"** to pull:

- ✅ Lab results (all observations with category=laboratory)
- ✅ Vitals (blood pressure, heart rate, weight, temperature)
- ✅ Imaging reports (CT, MRI, PET scans)
- ✅ Pathology reports (biopsies, surgical path)
- ✅ Medications (active prescriptions)
- ✅ Conditions/Diagnoses
- ✅ Signatera/ctDNA results (if coded with LOINC 96603-3)

**Data is automatically de-duplicated** - running sync multiple times won't create duplicate records.

### Automatic Refresh

Access tokens expire after 1 hour, but the system automatically:
- ✅ Detects expiration
- ✅ Uses refresh token to get new access token
- ✅ Continues syncing seamlessly

**You never have to re-login** unless you revoke access.

## Troubleshooting

### "Invalid redirect_uri"
**Problem:** Epic says your redirect URI doesn't match.  
**Fix:** Make sure you registered **exactly** `http://localhost:3000/api/fhir/callback` (no trailing slash, no https).

### "Missing EPIC_CLIENT_ID"
**Problem:** You forgot to add the Client ID to `.env`.  
**Fix:** Edit `.env` and add: `EPIC_CLIENT_ID=your_client_id_here`

### "Not authorized"
**Problem:** You haven't connected Epic MyChart yet.  
**Fix:** Click "Connect Epic MyChart" in the Portals tab and complete the authorization flow.

### "Access token expired"
**Problem:** Token expired and no refresh token available.  
**Fix:** This should auto-refresh, but if it doesn't, click "Connect Epic MyChart" again.

### "No records imported"
**Possible reasons:**
1. You don't have any data in Epic MyChart
2. Data is already in the database (check test_results, medications, conditions tables)
3. Your Epic health system doesn't expose certain resources (check FHIR conformance statement)

## Production Deployment

When deploying to a real server (not localhost):

1. **Update redirect URI** in Epic app settings:
   - From: `http://localhost:3000/api/fhir/callback`
   - To: `https://yourdomain.com/api/fhir/callback`
   
2. **Update .env:**
   ```bash
   APP_BASE_URL=https://yourdomain.com
   ```

3. **Use HTTPS** (required by Epic for production apps)

4. **Submit for production approval** at Epic:
   - Epic reviews your app
   - Approval takes 1-2 weeks
   - Once approved, works with ANY Epic health system

## Next Steps

- **Try it with Epic sandbox:** Use Epic's test patient data before connecting your real account
- **Add Cerner support:** Register at https://code-console.cerner.com/ and add CERNER_CLIENT_ID to .env
- **Add more EHR systems:** Follow the same SMART on FHIR flow for athenahealth, Allscripts, etc.

## Resources

- **Full setup guide:** `FHIR-SETUP-GUIDE.md`
- **Epic FHIR docs:** https://fhir.epic.com/Documentation
- **SMART on FHIR spec:** http://hl7.org/fhir/smart-app-launch/
- **Test with Epic sandbox:** https://fhir.epic.com/Documentation?docId=testpatients

## Questions?

See the full setup guide: `FHIR-SETUP-GUIDE.md`
