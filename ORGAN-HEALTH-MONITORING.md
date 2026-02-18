# Organ Health Monitoring System 🫀🫁🩺

**Date:** February 18, 2026  
**Feature:** Conditional organ-specific health monitoring  
**Organs:** Bone, Liver, Lungs, Kidneys

---

## Overview

MRT now includes **intelligent organ health monitoring** that activates only when clinical indicators are present. Each organ system has specific triggers based on lab values, imaging findings, and diagnoses.

**Philosophy:** Don't alarm patients unnecessarily. Only show monitoring when there's a medical reason.

---

## Supported Organs

### 1. 🦴 Bone Health

**Triggers:**
- Bone metastases or osseous lesions in conditions
- Elevated Alkaline Phosphatase (>147 U/L)
- Elevated Calcium (>10.2 mg/dL)
- Abnormal bone imaging findings

**Lab Markers:**
- Alkaline Phosphatase (ALP): 39-147 U/L
- Calcium: 8.5-10.2 mg/dL

**Implementation:** `server/bone-health.js` (existing)

---

### 2. 🫀 Liver Health

**Triggers:**
- Liver/hepatic metastases in conditions
- Elevated AST (>40 U/L)
- Elevated ALT (>56 U/L)
- Elevated Bilirubin (>1.2 mg/dL)
- Abnormal liver/hepatic imaging findings

**Lab Markers:**
- AST (SGOT): 10-40 U/L
- ALT (SGPT): 7-56 U/L
- Total Bilirubin: 0.1-1.2 mg/dL

**Common Issues:**
- Chemotherapy-induced hepatotoxicity
- Liver metastases (common in GI, breast, lung cancers)
- Drug interactions (many cancer drugs are hepatotoxic)

---

### 3. 🫁 Lung Health

**Triggers:**
- Lung/pulmonary metastases or nodules in conditions
- Low oxygen saturation (<92%)
- Abnormal chest imaging (nodules, masses, opacities)

**Vital Signs:**
- Oxygen Saturation (SpO2): ≥92%

**Common Issues:**
- Pulmonary metastases
- Radiation pneumonitis
- Drug-induced lung toxicity (bleomycin, gemcitabine)
- Pleural effusions

---

### 4. 🩺 Kidney Health

**Triggers:**
- Kidney/renal metastases in conditions
- Elevated Creatinine (>1.2 mg/dL)
- Low GFR/eGFR (<60 mL/min/1.73m²)
- Elevated BUN (>20 mg/dL)
- Abnormal renal imaging findings

**Lab Markers:**
- Creatinine: 0.6-1.2 mg/dL
- GFR/eGFR: >60 mL/min/1.73m²
- BUN (Blood Urea Nitrogen): 7-20 mg/dL

**Common Issues:**
- Nephrotoxic chemotherapy (cisplatin, carboplatin)
- Kidney metastases (rare but serious)
- Contrast-induced nephropathy
- Chronic kidney disease progression

---

## API Endpoints

### Individual Organ Status

```bash
GET /api/organ-health/liver
GET /api/organ-health/lungs
GET /api/organ-health/kidneys
```

**Response:**
```json
{
  "shouldMonitor": true,
  "reason": "elevated_ast",
  "message": "Elevated AST: 65 U/L (normal: 10-40)"
}
```

### All Organs Status

```bash
GET /api/organ-health/all
```

**Response:**
```json
{
  "bone": {
    "shouldMonitor": true,
    "reason": "elevated_alk_phos",
    "message": "Elevated Alkaline Phosphatase: 165 U/L (normal: 39-147)"
  },
  "liver": {
    "shouldMonitor": false,
    "reason": "no_indicators",
    "message": "No clinical indicators for liver health monitoring"
  },
  "lungs": {
    "shouldMonitor": false,
    "reason": "no_indicators",
    "message": "No clinical indicators for lung health monitoring"
  },
  "kidneys": {
    "shouldMonitor": true,
    "reason": "elevated_creatinine",
    "message": "Elevated Creatinine: 1.5 mg/dL (normal: 0.6-1.2)"
  }
}
```

### Monitoring Summary

```bash
GET /api/organ-health/summary
```

**Response:**
```json
{
  "totalOrgans": 4,
  "organsNeedingMonitoring": 2,
  "organs": [
    {
      "organ": "bone",
      "reason": "elevated_alk_phos",
      "message": "Elevated Alkaline Phosphatase: 165 U/L (normal: 39-147)"
    },
    {
      "organ": "kidneys",
      "reason": "elevated_creatinine",
      "message": "Elevated Creatinine: 1.5 mg/dL (normal: 0.6-1.2)"
    }
  ],
  "allStatuses": { /* full status object */ }
}
```

---

## Database Tables Used

### `conditions`
```sql
SELECT * FROM conditions 
WHERE active = 1 
  AND (
    name LIKE '%liver%metast%' OR
    name LIKE '%lung%metast%' OR
    name LIKE '%kidney%metast%' OR
    name LIKE '%bone%metast%'
  );
```

### `test_results`
```sql
-- Liver markers
SELECT * FROM test_results WHERE test_name LIKE '%AST%' ORDER BY date DESC LIMIT 1;
SELECT * FROM test_results WHERE test_name LIKE '%ALT%' ORDER BY date DESC LIMIT 1;
SELECT * FROM test_results WHERE test_name LIKE '%Bilirubin%' ORDER BY date DESC LIMIT 1;

-- Kidney markers
SELECT * FROM test_results WHERE test_name LIKE '%Creatinine%' ORDER BY date DESC LIMIT 1;
SELECT * FROM test_results WHERE test_name LIKE '%GFR%' ORDER BY date DESC LIMIT 1;
SELECT * FROM test_results WHERE test_name LIKE '%BUN%' ORDER BY date DESC LIMIT 1;

-- Bone markers
SELECT * FROM test_results WHERE test_name LIKE '%Alkaline%Phosphatase%' ORDER BY date DESC LIMIT 1;
SELECT * FROM test_results WHERE test_name LIKE '%Calcium%' ORDER BY date DESC LIMIT 1;
```

### `vitals`
```sql
-- Lung health
SELECT * FROM vitals WHERE vital_type = 'oxygen_saturation' ORDER BY date DESC LIMIT 1;
```

### `imaging_results` (optional)
```sql
-- Check for abnormal findings in organ-specific imaging
SELECT * FROM imaging_results 
WHERE name LIKE '%liver%' 
  AND findings LIKE '%metast%';
```

---

## Frontend Integration

### Health Dashboard Widget

```jsx
import { useState, useEffect } from 'react';

function OrganHealthDashboard() {
  const [organStatus, setOrganStatus] = useState({});
  
  useEffect(() => {
    fetch('/api/organ-health/all')
      .then(res => res.json())
      .then(data => setOrganStatus(data));
  }, []);
  
  return (
    <div className="organ-health-dashboard">
      {Object.entries(organStatus).map(([organ, status]) => (
        <OrganHealthCard 
          key={organ}
          organ={organ}
          shouldMonitor={status.shouldMonitor}
          reason={status.reason}
          message={status.message}
        />
      ))}
    </div>
  );
}
```

### Conditional Rendering

```jsx
function OrganHealthCard({ organ, shouldMonitor, reason, message }) {
  if (!shouldMonitor) {
    return (
      <Card>
        <CheckCircleIcon color="success" />
        <Typography variant="h6">
          {organ.charAt(0).toUpperCase() + organ.slice(1)} Health ✓
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {message}
        </Typography>
      </Card>
    );
  }
  
  return (
    <Card>
      <WarningIcon color="warning" />
      <Typography variant="h6">
        {organ.charAt(0).toUpperCase() + organ.slice(1)} Health Monitoring Active
      </Typography>
      <Typography variant="body2">
        {message}
      </Typography>
      <Button href={`/health/${organ}`}>View Details</Button>
    </Card>
  );
}
```

---

## Testing Scenarios

### Scenario 1: User with liver metastases

```sql
INSERT INTO conditions (name, active, diagnosis_date) 
VALUES ('Liver metastases', 1, '2026-01-15');
```

**Result:**  
✅ Liver monitoring activates (reason: `liver_metastases`)

---

### Scenario 2: User with elevated kidney markers

```sql
INSERT INTO test_results (test_name, result, date) 
VALUES 
  ('Creatinine', '1.8 mg/dL HIGH', '2026-02-18'),
  ('GFR', '45 mL/min/1.73m2 LOW', '2026-02-18');
```

**Result:**  
✅ Kidney monitoring activates (reason: `elevated_creatinine` or `low_gfr`)

---

### Scenario 3: User with low oxygen

```sql
INSERT INTO vitals (vital_type, value, date) 
VALUES ('oxygen_saturation', 88, '2026-02-18');
```

**Result:**  
✅ Lung monitoring activates (reason: `low_oxygen`)

---

### Scenario 4: User with normal labs, no metastases

**Result:**  
✅ All organs show "Monitoring Not Required" message

---

## Benefits

1. **Reduces Noise** - Only shows monitoring when clinically relevant
2. **Prevents Anxiety** - No false alarms for organs without issues
3. **Automatic Activation** - Monitoring enables if indicators develop
4. **Evidence-Based** - Uses actual lab values and diagnoses
5. **Comprehensive** - Covers major metastatic sites and organ toxicities
6. **Scalable** - Easy to add more organs (brain, adrenal, etc.)

---

## Future Enhancements

### 1. Trend Detection

Activate monitoring if markers are *rising* even if not yet abnormal:

```javascript
if (astIncreasing > 50% over 2 months && ast > 30) {
  return { shouldMonitor: true, reason: 'rising_ast' };
}
```

### 2. More Organs

**Brain:**
- Brain metastases detection
- Neurological symptoms tracking
- MRI findings

**Adrenal:**
- Adrenal metastases (common in lung cancer)
- Cortisol levels
- CT/MRI findings

**Peritoneum:**
- Peritoneal metastases
- Ascites
- CA-125 levels (ovarian cancer)

### 3. Organ-Specific Dashboards

Full monitoring dashboards for each organ when activated:

- **Liver Dashboard:** AST/ALT/Bilirubin trends, hepatotoxic drug warnings
- **Kidney Dashboard:** Creatinine/GFR trends, nephrotoxic drug warnings
- **Lung Dashboard:** O2 sat trends, chest imaging timeline

### 4. Smart Recommendations

```javascript
if (shouldMonitorLiver && onHepatotoxicDrugs) {
  return {
    recommendations: [
      'Request liver function panel every 2 weeks',
      'Consider hepatoprotective supplements (milk thistle, NAC)',
      'Discuss dose reduction with oncologist if AST/ALT >3x normal'
    ]
  };
}
```

### 5. Integration with Treatment Plans

```javascript
if (shouldMonitorKidneys && scheduledForCisplatin) {
  return {
    alert: 'URGENT: Kidney function borderline. Cisplatin may cause acute kidney injury.',
    recommendations: [
      'Aggressive hydration protocol (pre/post infusion)',
      'Consider carboplatin or alternative platinum agent',
      'Nephrology consult if GFR <60'
    ]
  };
}
```

---

## Files Created

```
server/organ-health.js            # Organ monitoring logic
server/index.js                   # API endpoint integration (updated)
ORGAN-HEALTH-MONITORING.md        # This documentation
```

---

## Example Use Cases

### Case 1: Chemotherapy Monitoring

**Patient:** Receiving cisplatin + gemcitabine for lung cancer

**Automatic Monitoring:**
- ✅ Kidney (cisplatin is nephrotoxic)
- ✅ Liver (gemcitabine can cause hepatotoxicity)
- ❌ Bone (no bone involvement)

**Alerts:**
- Creatinine >1.5 mg/dL → "ALERT: Kidney function declining. Consider dose adjustment."

---

### Case 2: Metastatic Disease

**Patient:** Stage IV breast cancer with liver and bone mets

**Automatic Monitoring:**
- ✅ Bone (bone metastases present)
- ✅ Liver (liver metastases present)
- ❌ Lungs (no lung involvement)
- ❌ Kidneys (normal renal function)

**Alerts:**
- ALP rising → "Bone metastases may be progressing. Consider bone scan."
- AST/ALT elevated → "Liver function declining. Imaging recommended."

---

### Case 3: Immunotherapy Toxicity

**Patient:** Receiving pembrolizumab (Keytruda)

**Automatic Monitoring:**
- ✅ Liver (immunotherapy can cause hepatitis)
- ✅ Lungs (immunotherapy can cause pneumonitis)
- ❌ Kidneys (rare toxicity)

**Alerts:**
- AST/ALT >5x normal → "URGENT: Immune-related hepatitis suspected. Hold immunotherapy."
- O2 sat <92% → "URGENT: Pneumonitis suspected. Imaging and pulmonology consult."

---

## Commit Message

```
Add comprehensive organ health monitoring system (liver, lungs, kidneys)

- Created organ-health.js with conditional monitoring for 4 organ systems
- Triggers based on metastases, lab values, vitals, imaging
- API endpoints: /api/organ-health/{liver|lungs|kidneys|all|summary}
- Automatic activation when clinical indicators present
- Reduces noise and prevents unnecessary anxiety
- Scalable design for future organ additions (brain, adrenal, etc.)

Organ systems:
- Bone: mets, elevated ALP/calcium, abnormal imaging
- Liver: mets, elevated AST/ALT/bilirubin, abnormal imaging
- Lungs: mets/nodules, low O2 sat, abnormal chest imaging
- Kidneys: mets, elevated creatinine/BUN, low GFR, abnormal imaging

Files:
- server/organ-health.js (new, 11KB)
- server/index.js (updated with API endpoints)
- ORGAN-HEALTH-MONITORING.md (comprehensive documentation)
```

---

## Result

✅ **MRT now has intelligent, conditional organ health monitoring**  
✅ Covers major metastatic sites and organ toxicities  
✅ Evidence-based triggers using real lab data and diagnoses  
✅ Scalable architecture for adding more organs  
✅ Reduces patient anxiety by only showing relevant alerts  

**Ship it!** 🚀
