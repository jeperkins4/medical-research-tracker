# 🔒 HIPAA-Compliant Analytics System

## Overview

This system allows you to track **aggregated, de-identified user data** while maintaining **100% HIPAA compliance**. No individual patient information (PHI) is ever exposed.

---

## What You Can Track (HIPAA-Compliant)

### ✅ Safe to Track

| Metric | Example | HIPAA Status |
|--------|---------|--------------|
| **Total Users** | "250 registered users" | ✅ Compliant (count only) |
| **Diagnosis Types** | "15 users have bladder cancer" | ✅ Compliant (aggregated, min 11) |
| **Cancer Stages** | "22 users have Stage 4 cancer" | ✅ Compliant (aggregated, min 11) |
| **Mutations** | "18 users have PIK3CA mutations" | ✅ Compliant (aggregated, min 11) |
| **Treatments** | "30 users taking Curcumin" | ✅ Compliant (aggregated, min 11) |
| **Age Ranges** | "25 users aged 56-65" | ✅ Compliant (ranges, not exact ages) |
| **State Location** | "15 users from Florida" | ✅ Compliant (state-level only) |
| **Gender** | "40 Male, 35 Female" | ✅ Compliant (aggregated, min 11) |

### ❌ NOT Allowed (Would Violate HIPAA)

| Data Type | Why It's Prohibited |
|-----------|---------------------|
| Individual names | Direct identifier |
| Email addresses | Direct identifier |
| Exact ages | Can identify individuals |
| Birth dates | Direct identifier |
| City/ZIP codes | Geographic smaller than state |
| Phone numbers | Direct identifier |
| IP addresses | HIPAA identifier |
| Groups < 11 people | Re-identification risk |

---

## How It Works

### 1. **Data Flow**

```
┌─────────────────────────────────────────────────────────────┐
│ PHI Database (Encrypted)                                    │
│ - Individual patient records                                │
│ - Names, dates, exact ages, cities                          │
│ - ENCRYPTED AT REST (AES-256)                              │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  │ Nightly Aggregation (2:00 AM)
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ Analytics Database (De-identified)                          │
│ - Aggregated counts only                                    │
│ - Age ranges (not exact ages)                               │
│ - State-level location (not city/ZIP)                       │
│ - NO individual identifiers                                 │
│ - Minimum cell size: 11 (smaller groups suppressed)         │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  │ API Access (Admin Only)
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ Analytics Dashboard                                         │
│ - View de-identified trends                                 │
│ - Export aggregate reports                                  │
│ - ALL ACCESS LOGGED (audit trail)                          │
└─────────────────────────────────────────────────────────────┘
```

### 2. **Safe Harbor De-identification**

We follow HIPAA's **Safe Harbor** method (§164.514(b)(2)) which requires removing 18 specific identifiers:

#### ✅ Our Implementation:

| HIPAA Requirement | How We Comply |
|-------------------|---------------|
| 1. Names | ❌ Never stored in analytics DB |
| 2. Geographic < State | ❌ Only state-level data allowed |
| 3. Dates (except year) | ❌ Only year stored, no exact dates |
| 4-7. Contact Info | ❌ No phone/fax/email in analytics |
| 8-11. ID Numbers | ❌ No SSN/medical record/account numbers |
| 12-13. Device IDs | ❌ Not tracked |
| 14. URLs | ❌ Not tracked |
| 15. IP Addresses | ⚠️ Logged in audit trail only (admin access tracking) |
| 16. Biometrics | ❌ Not tracked |
| 17. Photos | ❌ Not tracked |
| 18. Unique IDs | ❌ No user IDs linked to aggregates |

#### 🔐 Additional Protection: Minimum Cell Size

Even after removing identifiers, we enforce a **minimum cell size of 11** individuals in any category. Groups smaller than 11 are **suppressed** (not displayed) to prevent statistical re-identification.

**Example:**
- ✅ "15 users have ARID1A mutations" → **Displayed**
- ❌ "3 users have rare mutation XYZ" → **Suppressed** (< 11)

---

## Database Schema

### Analytics Tables (De-identified Only)

```sql
-- User metrics (counts only)
analytics_user_metrics
  - total_users         (count)
  - new_users_today     (count)
  - active_users_30d    (count)

-- Diagnosis aggregates (no patient IDs)
analytics_diagnosis_aggregates
  - diagnosis_type      (e.g., "Bladder Cancer")
  - cancer_type         (e.g., "Bladder")
  - stage               (e.g., "Stage 4")
  - patient_count       (min 11)

-- Mutation aggregates (no patient IDs)
analytics_mutation_aggregates
  - gene_name           (e.g., "PIK3CA")
  - mutation_type       (e.g., "Gain of Function")
  - patient_count       (min 11)

-- Treatment aggregates (no patient IDs)
analytics_treatment_aggregates
  - treatment_name      (e.g., "Curcumin")
  - treatment_type      (e.g., "Supplement")
  - patient_count       (min 11)

-- Demographics (HIPAA-compliant ranges)
analytics_demographics
  - demographic_type    (e.g., "age_range")
  - demographic_value   (e.g., "56-65")
  - patient_count       (min 11)
```

**Key Point:** These tables contain ZERO patient identifiers. Cannot be reverse-linked to individuals.

---

## API Endpoints

All endpoints are **admin-only** and **audit-logged**.

| Endpoint | Returns | HIPAA Status |
|----------|---------|--------------|
| `GET /api/analytics/dashboard` | All aggregates | ✅ Compliant |
| `GET /api/analytics/users` | User metrics | ✅ Compliant |
| `GET /api/analytics/diagnoses` | Diagnosis counts | ✅ Compliant |
| `GET /api/analytics/mutations` | Mutation counts | ✅ Compliant |
| `GET /api/analytics/treatments` | Treatment counts | ✅ Compliant |
| `GET /api/analytics/demographics` | Age/gender/state | ✅ Compliant |
| `GET /api/analytics/audit-log` | Access history | ✅ Compliant |

**Security:**
- ✅ Requires authentication
- ✅ Admin-only access
- ✅ All access logged with timestamp, user ID, IP address
- ✅ Audit trail retained indefinitely

---

## Aggregation Schedule

Analytics are **generated nightly at 2:00 AM EST** via cron job:

```bash
# Cron job (in server/index.js)
cron.schedule('0 2 * * *', async () => {
  console.log('🔄 Running nightly analytics aggregation...');
  await generateAllAnalytics();
});
```

**Process:**
1. Reads encrypted PHI database
2. Generates de-identified aggregates
3. Applies minimum cell size rule (suppress < 11)
4. Writes to analytics tables
5. No PHI touches analytics database

---

## Usage Examples

### Dashboard View

```javascript
// Fetch all analytics
const response = await fetch('/api/analytics/dashboard');
const data = await response.json();

console.log(data.userMetrics.total_users);  // 250
console.log(data.diagnoses);                 // [{cancer_type: 'Bladder', stage: 'Stage 4', patient_count: 15}, ...]
```

### Export Report

```javascript
// Generate CSV report
const diagnoses = await fetch('/api/analytics/diagnoses').then(r => r.json());

const csv = diagnoses.map(d => 
  `${d.cancer_type},${d.stage},${d.patient_count}`
).join('\n');

// Safe to share externally - no PHI
```

---

## Compliance Checklist

Use this checklist to verify HIPAA compliance:

### ✅ Safe Harbor De-identification

- [ ] No individual names in analytics DB
- [ ] No geographic data smaller than state
- [ ] No exact dates (year only)
- [ ] No email/phone/fax numbers
- [ ] No SSN, medical record numbers, account numbers
- [ ] No device IDs or IP addresses (except audit log)
- [ ] No biometric identifiers
- [ ] No full-face photos
- [ ] No unique identifying codes linked to individuals

### ✅ Statistical Safeguards

- [ ] Minimum cell size enforced (11 individuals)
- [ ] Small groups suppressed
- [ ] Age ranges used (not exact ages)
- [ ] Cannot re-identify individuals from aggregate data

### ✅ Security Controls

- [ ] Admin-only access to analytics
- [ ] All access logged (audit trail)
- [ ] API requires authentication
- [ ] PHI database encrypted at rest (AES-256)
- [ ] Analytics DB cannot be reverse-linked to PHI

### ✅ Operational

- [ ] Nightly aggregation runs automatically
- [ ] Audit logs retained
- [ ] Analytics dashboard tested
- [ ] Data cannot identify individuals

---

## Legal Basis

This system complies with:

1. **HIPAA Privacy Rule** (45 CFR §164.514)
   - Safe Harbor de-identification method
   - Removes all 18 identifiers
   - Expert statistical verification not required (Safe Harbor method)

2. **HIPAA Security Rule** (45 CFR §164.306-316)
   - Encryption at rest (AES-256)
   - Access controls (admin-only)
   - Audit trails (all access logged)

3. **HITECH Act** (2009)
   - Breach notification (if analytics DB compromised, NO PHI exposed → no breach)

**Key Legal Protection:** If the analytics database is compromised, **no PHI is exposed** because it contains only de-identified aggregates.

---

## Audit Trail

Every analytics access is logged:

```sql
analytics_audit_log
  - user_id          (who accessed)
  - action           (what they did)
  - ip_address       (where from)
  - accessed_at      (when)
```

**Retention:** Logs are retained indefinitely for compliance audits.

---

## FAQs

### Q: Can I track individual patient outcomes?

**A:** No. HIPAA requires de-identification. You can track **aggregated** outcomes (e.g., "20 users responded to treatment"), but not individual patients.

---

### Q: What if I have only 8 users with a specific mutation?

**A:** That data is **suppressed** (not shown) because it's below the minimum cell size of 11. This prevents re-identification.

---

### Q: Can I share analytics reports externally?

**A:** Yes! Since the data is de-identified and aggregated, it's NOT considered PHI under HIPAA. You can share reports with researchers, investors, or the public.

---

### Q: What if someone reverse-engineers user identities from aggregates?

**A:** The minimum cell size (11) and Safe Harbor de-identification make re-identification **statistically improbable**. Even if someone knows a user has bladder cancer, they cannot identify which of the 15+ users in that category is the specific person.

---

### Q: Do I need a Business Associate Agreement (BAA)?

**A:** No. De-identified data is NOT covered by HIPAA, so you don't need BAAs when sharing analytics externally.

---

## Setup

See `ANALYTICS-SETUP.md` for installation instructions.

---

## Support

**Questions about HIPAA compliance?**
- Read HIPAA Privacy Rule: https://www.hhs.gov/hipaa/for-professionals/privacy/index.html
- Consult legal counsel for specific compliance questions
- This system follows Safe Harbor de-identification (§164.514(b)(2))

**Technical questions?**
- Check `ANALYTICS-SETUP.md` for setup help
- View audit logs: `GET /api/analytics/audit-log`

---

**Status:** ✅ HIPAA-COMPLIANT  
**Method:** Safe Harbor De-identification (§164.514(b)(2))  
**Min Cell Size:** 11 individuals  
**Audit Trail:** All access logged  
**Data Security:** AES-256 encryption at rest

🔒 **No PHI is ever exposed through this analytics system.**
