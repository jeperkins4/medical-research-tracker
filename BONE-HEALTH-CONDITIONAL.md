# Conditional Bone Health Monitoring ✅

**Date:** February 18, 2026  
**Task:** Make bone health tracking conditional - only show when clinically warranted.

---

## Problem

Bone health tracker was showing for all users unconditionally. This creates unnecessary alerts for patients without bone involvement.

---

## Solution

**Bone health monitoring now only activates when clinical indicators are present:**

### Triggers (any one activates monitoring):

1. **Bone Metastases or Osseous Lesions**
   - Checks `conditions` table for:
     - "bone metast%"
     - "osseous%"
     - "skeletal metast%"
     - Similar terms in notes field

2. **Elevated Alkaline Phosphatase**
   - Latest ALP > 147 U/L (normal range: 39-147)
   - Checked from `test_results` table

3. **Elevated Calcium**
   - Latest calcium > 10.2 mg/dL (normal range: 8.5-10.2)
   - Checked from `test_results` table

4. **Abnormal Bone Imaging**
   - Bone scans, skeletal surveys, spine/pelvis imaging
   - With findings mentioning: metastases, lesions, abnormalities
   - Checked from `imaging_results` table (if exists)

---

## Changes Made

### 1. **Server-Side: `server/bone-health.js`**

**Added `shouldMonitorBoneHealth()` function:**

```javascript
export function shouldMonitorBoneHealth() {
  // Check conditions table for bone involvement
  // Check test_results for elevated ALP or calcium
  // Check imaging_results for abnormal findings
  
  return {
    shouldMonitor: true/false,
    reason: 'bone_metastases' | 'elevated_alk_phos' | 'elevated_calcium' | 'abnormal_imaging' | 'no_indicators',
    message: 'Human-readable explanation'
  };
}
```

**Updated `getBoneHealthData()` to check first:**

```javascript
export function getBoneHealthData() {
  const monitorCheck = shouldMonitorBoneHealth();
  
  if (!monitorCheck.shouldMonitor) {
    return {
      enabled: false,
      reason: monitorCheck.reason,
      message: monitorCheck.message
    };
  }
  
  // ... existing code to fetch ALP data, supplements, etc.
  
  return {
    enabled: true,
    reason: monitorCheck.reason,
    message: monitorCheck.message,
    alkPhosData,
    currentSupplements,
    missingSupplements,
    trend,
    riskLevel
  };
}
```

### 2. **Frontend: `src/components/BoneHealthTracker.jsx`**

**Added state for enabled status:**

```javascript
const [enabled, setEnabled] = useState(false);
const [disabledReason, setDisabledReason] = useState('');
```

**Updated `fetchBoneHealthData()` to check:**

```javascript
const data = await response.json();

if (!data.enabled) {
  setEnabled(false);
  setDisabledReason(data.message);
  return;
}

setEnabled(true);
// ... load data
```

**Added conditional render for disabled state:**

```jsx
if (!enabled) {
  return (
    <Card>
      <CheckCircleIcon /> Bone Health Monitoring Not Required
      <Typography>{disabledReason}</Typography>
      
      <Alert severity="info">
        Bone health monitoring is triggered when:
        - Bone metastases or osseous lesions are present
        - Alkaline Phosphatase is elevated (>147 U/L)
        - Calcium is elevated (>10.2 mg/dL)
        - Abnormal bone imaging findings
      </Alert>
    </Card>
  );
}

// ... existing bone health dashboard
```

---

## User Experience

### Before:
- All users see bone health tracker regardless of relevance
- Creates confusion and unnecessary anxiety

### After:
**No bone involvement:**
```
✅ Bone Health Monitoring Not Required

No clinical indicators for bone health monitoring

Bone health monitoring is triggered when:
• Bone metastases or osseous lesions are present
• Alkaline Phosphatase is elevated (>147 U/L)
• Calcium is elevated (>10.2 mg/dL)
• Abnormal bone imaging findings

ℹ️ If you develop any of these conditions, bone health tracking will 
automatically activate to help monitor for skeletal-related events.
```

**With bone involvement:**
```
🦴 Bone Health Tracker
Monitoring Alkaline Phosphatase & Bone Metastases Risk

⚠️ URGENT: Rising Alkaline Phosphatase Detected
Your Alk Phos has increased by 27.5% over the past 8 weeks...

[Full dashboard with charts, supplements, actions]
```

---

## Testing Scenarios

### Scenario 1: User with bone metastases
```sql
INSERT INTO conditions (name, active) VALUES ('Bone metastases', 1);
```
**Result:** ✅ Bone health tracker activates (reason: bone_metastases)

### Scenario 2: User with elevated ALP
```sql
INSERT INTO test_results (test_name, result, date) 
VALUES ('Alkaline Phosphatase', '165 U/L HIGH', '2026-02-18');
```
**Result:** ✅ Bone health tracker activates (reason: elevated_alk_phos)

### Scenario 3: User with normal labs, no bone involvement
**Result:** ✅ Shows "Monitoring Not Required" message

### Scenario 4: User with elevated calcium
```sql
INSERT INTO test_results (test_name, result, date) 
VALUES ('Calcium', '10.8 mg/dL HIGH', '2026-02-18');
```
**Result:** ✅ Bone health tracker activates (reason: elevated_calcium)

---

## Benefits

1. **Reduces noise** - Only shows when clinically relevant
2. **Prevents anxiety** - No false alarms for users without bone issues
3. **Automatic activation** - If bone mets develop later, tracking auto-enables
4. **Clear messaging** - Explains why monitoring is/isn't active
5. **Evidence-based** - Uses actual lab values and diagnoses

---

## Database Tables Used

```sql
-- conditions: Check for bone metastases/osseous lesions
SELECT * FROM conditions WHERE active = 1 AND name LIKE '%bone%metast%';

-- test_results: Check ALP and calcium levels
SELECT * FROM test_results WHERE test_name LIKE '%Alk%Phos%' ORDER BY date DESC LIMIT 1;
SELECT * FROM test_results WHERE test_name LIKE '%Calcium%' ORDER BY date DESC LIMIT 1;

-- imaging_results: Check bone scan findings (optional, if table exists)
SELECT * FROM imaging_results WHERE name LIKE '%bone%scan%' AND findings LIKE '%metast%';
```

---

## Edge Cases Handled

1. **No test results yet** - Returns `shouldMonitor: false`
2. **`imaging_results` table doesn't exist** - Wrapped in try/catch, fails silently
3. **ALP or calcium format variations** - Uses regex to extract numeric value
4. **Multiple conditions** - Returns on first match (early exit)
5. **Historical vs. current conditions** - Only checks `active = 1` conditions

---

## Future Enhancements

### 1. **More Lab Markers**
Add checks for:
- CTX (C-telopeptide) - bone resorption marker
- NTX (N-telopeptide) - bone breakdown
- PTH (parathyroid hormone) - calcium regulation
- Vitamin D levels (low D can affect bone health)

### 2. **Trend Detection**
Activate monitoring if ALP is *rising* even if not yet elevated:
```javascript
if (alkPhosIncreasing > 20% over 3 months) {
  return { shouldMonitor: true, reason: 'rising_alk_phos' };
}
```

### 3. **User Override**
Allow users to manually enable bone health tracking (e.g., family history, prophylactic monitoring):
```javascript
const userPrefs = query('SELECT bone_health_override FROM user_preferences');
if (userPrefs[0].bone_health_override) {
  return { shouldMonitor: true, reason: 'user_enabled' };
}
```

### 4. **Smart Recommendations**
If monitoring is disabled but user has cancer diagnosis:
```javascript
if (!shouldMonitor && hasCancer && monthsSinceDiagnosis > 6) {
  return {
    shouldMonitor: false,
    suggestion: 'Consider baseline bone scan and ALP check at 6-month follow-up'
  };
}
```

---

## Commit Message

```
Make bone health monitoring conditional (only show when clinically warranted)

- Added shouldMonitorBoneHealth() function to check clinical indicators
- Triggers: bone mets, elevated ALP (>147), elevated calcium (>10.2), abnormal imaging
- Frontend shows friendly "Monitoring Not Required" message when disabled
- Automatically activates if indicators develop later
- Reduces noise and prevents unnecessary anxiety for users without bone involvement

Files modified:
- server/bone-health.js (added shouldMonitorBoneHealth, updated getBoneHealthData)
- src/components/BoneHealthTracker.jsx (conditional render based on enabled flag)
```

---

## Result

✅ **Bone health tracker is now contextual and evidence-based**  
✅ Only shows when there's a medical reason to monitor  
✅ Clear messaging explains when it activates  
✅ Automatically enables if indicators develop  

**Ship it!** 🚀
