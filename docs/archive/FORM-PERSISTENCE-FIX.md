# Form Persistence Fix - Data Loss Prevention

## Problem

**User reported:** "Data keeps disappearing after the first button clicked"

### Root Cause

React components using conditional rendering (`{activeTab === 'treatment' && <TreatmentView />}`) completely **unmount** when switching tabs. This means:

1. User fills out medication form (name, dosage, notes)
2. User clicks different tab (e.g., "Research")
3. `MedicationManager` component unmounts
4. All local state (including `formData`) is **destroyed**
5. When returning to Treatment tab, component remounts with **empty form**

**Result:** All unsaved form data is lost.

## Solution

### Implemented: sessionStorage Persistence

**File:** `src/components/MedicationManager.jsx`

**Changes:**

1. **Restore form data on mount** from sessionStorage:
```javascript
const getInitialFormData = () => {
  const saved = sessionStorage.getItem('medicationFormData');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (err) {
      console.warn('Failed to parse saved form data:', err);
    }
  }
  return { /* default empty form */ };
};

const [formData, setFormData] = useState(getInitialFormData);
```

2. **Auto-save form data** whenever it changes:
```javascript
useEffect(() => {
  if (showAddForm && (formData.name || formData.dosage || formData.notes)) {
    sessionStorage.setItem('medicationFormData', JSON.stringify(formData));
  }
}, [formData, showAddForm]);
```

3. **Clear saved data** when form is submitted or cancelled:
```javascript
const resetForm = () => {
  // ... reset formData state
  sessionStorage.removeItem('medicationFormData');
};
```

4. **Visual indicator** when data is restored:
```javascript
{!editingMed && sessionStorage.getItem('medicationFormData') && (
  <div className="restored-notice">
    💾 Your unsaved changes were restored. Click "Cancel" to discard.
  </div>
)}
```

## Benefits

✅ **Survives tab switches** - Form data persists even when component unmounts  
✅ **Survives page refresh** - sessionStorage persists until browser tab closes  
✅ **Automatic** - No user action required  
✅ **Visual feedback** - User knows data was restored  
✅ **Clean on submit** - Clears storage after successful save  

## Testing Checklist

**Test Case 1: Tab Switch**
1. Go to Treatment → Medications & Supplements
2. Click "Add Medication"
3. Fill in: Name="Curcumin", Dosage="500mg"
4. Click "Research" tab (navigate away)
5. Click "Treatment" tab (come back)
6. **Expected:** Form shows "Curcumin" and "500mg" (with yellow notice)
7. **Before fix:** Form was empty ❌
8. **After fix:** Form restored ✅

**Test Case 2: Successful Submit**
1. Fill out medication form
2. Click "Add Medication"
3. Click "Add Medication" again (new form)
4. **Expected:** Form is empty (previous data cleared)

**Test Case 3: Cancel**
1. Fill out medication form
2. Click "Cancel"
3. Click "Add Medication" again
4. **Expected:** Form is empty (previous data cleared)

**Test Case 4: Page Refresh**
1. Fill out medication form
2. Refresh browser (F5)
3. Log back in
4. Go to Treatment → Medications
5. **Expected:** Form is empty (sessionStorage cleared on logout/refresh in main session)

## Future Enhancements

### Option 1: "Unsaved Changes" Warning
Show browser confirmation before navigating away:
```javascript
useEffect(() => {
  const hasUnsavedChanges = formData.name || formData.dosage;
  
  const handleBeforeUnload = (e) => {
    if (hasUnsavedChanges) {
      e.preventDefault();
      e.returnValue = '';
    }
  };
  
  window.addEventListener('beforeunload', handleBeforeUnload);
  return () => window.removeEventListener('beforeunload', handleBeforeUnload);
}, [formData]);
```

### Option 2: Keep Components Mounted
Change App.jsx to use CSS visibility instead of conditional rendering:
```javascript
<main>
  <div style={{ display: activeTab === 'profile' ? 'block' : 'none' }}>
    <OverviewView />
  </div>
  <div style={{ display: activeTab === 'treatment' ? 'block' : 'none' }}>
    <TreatmentView />
  </div>
  {/* etc */}
</main>
```

**Pros:** No unmounting, state always preserved  
**Cons:** All components loaded at once (higher memory usage)

### Option 3: Global State Management
Use React Context or Redux to persist form state at app level (not component level).

## Other Forms to Fix

These components also have forms that could lose data on tab switch:

1. **PatientView** (App.jsx:383) - Profile editing
2. **ConditionsView** (App.jsx:~500) - Adding conditions
3. **VitalsView** (App.jsx:~700) - Logging vitals
4. **NutritionTracker** (component) - Meal logging
5. **ResearchSearch** (component) - Search form with filters

**Priority:** Medication form was highest priority (most complex form). Others can be fixed as needed.

---

## Commit

```bash
git add src/components/MedicationManager.jsx
git commit -m "Fix: Persist medication form data across tab switches (sessionStorage)"
```

**Status:** ✅ FIXED - Form data now survives tab navigation
