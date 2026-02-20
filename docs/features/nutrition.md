# Meal Analysis Storage - Feature Documentation

**Implemented:** February 14, 2026, 7:15 AM EST  
**Status:** ✅ ACTIVE

---

## 🎯 **WHAT'S NEW**

AI meal analyses are now **automatically saved** when you rate a meal. You can re-view past analyses without re-running Claude (saving API costs and time).

---

## ✨ **FEATURES**

### 1. **Automatic Analysis Storage**
- Every time you click "RATE THIS MEAL", the AI analysis is automatically saved to the database
- Includes: scores, strengths, gaps, recommendations, pathway support
- Stored with timestamp and AI model used (Claude 3.5 Haiku)

### 2. **Instant Retrieval**
- Next time you click "RATE THIS MEAL" on the same meal → instant results
- NO Claude API call (saves ~$0.001 per retrieval)
- Shows "Saved [date]" badge in the modal

### 3. **Re-analyze Option**
- Cached analysis shows "Re-analyze" button
- Click to force fresh analysis with current genomic data
- Useful if you've updated medications or pathways

---

## 📊 **DATABASE SCHEMA**

### New Table: `meal_analyses`

```sql
CREATE TABLE meal_analyses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meal_id INTEGER NOT NULL,
  analysis_data TEXT NOT NULL,  -- Full JSON analysis
  model TEXT,                    -- AI model used
  analyzed_at TEXT,              -- Timestamp
  FOREIGN KEY (meal_id) REFERENCES meals(id) ON DELETE CASCADE
);
```

**What's Stored:**
- `overall_score` (0-100)
- `category_scores` (genomic_support, anti_cancer, treatment_alignment, nutrient_density, tolerability)
- `strengths` (array of what meal does well)
- `gaps` (array of missing nutrients/pathways)
- `recommendations` (array of specific improvements)
- `pathway_support` (which genomic pathways this meal addresses)
- `summary` (2-3 sentence overview)

---

## 🎨 **USER INTERFACE**

### When Viewing Cached Analysis:

**Dialog Title:**
```
🧠 AI Meal Analysis              [Saved Feb 14, 2026]
```

**Dialog Actions:**
```
[Re-analyze]                                [Close]
```

**Visual Indicators:**
- Blue "Saved [date]" chip in title bar
- "Re-analyze" button (purple outlined)
- Analysis displays identically whether cached or fresh

---

## 🔄 **WORKFLOW**

### First Analysis (Fresh):
1. User clicks "RATE THIS MEAL" on breakfast
2. API calls Claude Haiku (~2-3 seconds, ~$0.001)
3. Analysis returned and displayed
4. **Analysis automatically saved to database**

### Second View (Cached):
1. User clicks "RATE THIS MEAL" on same breakfast
2. API checks database first
3. Finds saved analysis → returns instantly (<100ms)
4. Shows "Saved Feb 14, 2026" badge
5. **NO Claude API call** (free, instant)

### Force Re-analysis:
1. User clicks "Re-analyze" button
2. API calls Claude Haiku with fresh data
3. New analysis returned
4. **Overwrites previous saved analysis**

---

## 💰 **COST SAVINGS**

**Before (No Storage):**
- Every "RATE THIS MEAL" = Claude API call (~$0.001)
- Re-viewing yesterday's meal = another API call (~$0.001)
- 100 meal views = $0.10

**After (With Storage):**
- First analysis = Claude API call (~$0.001)
- All subsequent views = database lookup (free)
- 100 meal views (10 unique meals, 10 views each) = $0.01 (90% savings)

---

## 🚀 **HOW TO USE**

### View Analysis (Cached):

1. **Go to:** Nutrition tab
2. **Find:** Today's Meals section
3. **Click:** "RATE THIS MEAL" button on any meal
4. **See:** Analysis appears instantly if previously analyzed
5. **Check:** "Saved [date]" badge confirms it's cached

### Force Fresh Analysis:

1. **Open:** Cached analysis (see above)
2. **Click:** "Re-analyze" button (bottom left)
3. **Wait:** 2-3 seconds for fresh Claude analysis
4. **See:** Updated results with latest genomic data

---

## 🔍 **TECHNICAL DETAILS**

### Backend Changes:

**New Functions (`server/meal-analyzer.js`):**
```javascript
getSavedAnalysis(mealId)   // Retrieve cached analysis
saveAnalysis(mealId, data, model)  // Store new analysis
```

**API Endpoint (`server/index.js`):**
```javascript
POST /api/nutrition/analyze-meal
  Parameters:
    - mealId (optional): Meal database ID
    - description: What you ate
    - treatment_phase: chemo_week | recovery_week | maintenance
    - energy_level: 1-10
    - nausea_level: 0-10
    - forceReanalyze: true/false (bypass cache)
  
  Response:
    - success: true/false
    - analysis: { overall_score, category_scores, ... }
    - cached: true/false (indicates if from database)
    - savedAt: timestamp (when analysis was generated)
```

### Frontend Changes:

**Component (`src/components/NutritionTracker.jsx`):**
- Updated `handleAnalyzeMeal()` to pass `mealId` and handle `cached` flag
- Added "Saved [date]" chip to dialog title
- Added "Re-analyze" button to dialog actions
- Stores meal data for re-analysis

---

## 📁 **FILES MODIFIED**

1. **Migration:**
   - `server/migrations/003-meal-analysis-storage.sql` - Database schema

2. **Backend:**
   - `server/meal-analyzer.js` - Added save/retrieve functions
   - `server/index.js` - Updated API endpoint to check cache

3. **Frontend:**
   - `src/components/NutritionTracker.jsx` - UI for cached analyses

4. **Database:**
   - `data/health-secure.db` - New `meal_analyses` table

---

## 🧪 **TESTING CHECKLIST**

### Test Case 1: Fresh Analysis
- [x] Log a new meal
- [x] Click "RATE THIS MEAL"
- [x] Analysis generated (2-3 second wait)
- [x] Results displayed

### Test Case 2: Cached Analysis
- [x] Click "RATE THIS MEAL" on same meal again
- [x] Analysis appears instantly
- [x] "Saved [date]" badge visible
- [x] "Re-analyze" button present

### Test Case 3: Re-analysis
- [x] Click "Re-analyze" button
- [x] New analysis generated (2-3 second wait)
- [x] Results updated
- [x] Still shows as cached on next view

### Test Case 4: Meal Deletion
- [x] Delete a meal with cached analysis
- [x] Verify analysis also deleted (CASCADE)

---

## 🛠️ **MAINTENANCE**

### Database Cleanup:

**Orphaned analyses** (if meal deleted):
Handled automatically via `ON DELETE CASCADE`

**Old analyses** (optional cleanup):
```sql
-- Delete analyses older than 6 months
DELETE FROM meal_analyses 
WHERE analyzed_at < date('now', '-6 months');
```

**Storage growth:**
- Each analysis: ~1-2 KB JSON
- 365 meals/year: ~730 KB
- Negligible storage impact

---

## 🔒 **SECURITY**

**Encryption:**
- ✅ Stored in encrypted database (`health-secure.db`)
- ✅ AES-256 SQLCipher encryption
- ✅ Same security as meal data

**Access Control:**
- ✅ Requires authentication (`requireAuth` middleware)
- ✅ Only accessible via localhost
- ✅ No external API exposure

---

## 📊 **QUERY EXAMPLES**

### Get All Analyses for a Meal:
```sql
SELECT * FROM meal_analyses 
WHERE meal_id = 3 
ORDER BY analyzed_at DESC;
```

### Count Cached Analyses:
```sql
SELECT COUNT(*) as total_analyses FROM meal_analyses;
```

### Top Scoring Meals:
```sql
SELECT m.description, 
       JSON_EXTRACT(ma.analysis_data, '$.overall_score') as score
FROM meals m
JOIN meal_analyses ma ON m.id = ma.meal_id
ORDER BY score DESC
LIMIT 10;
```

---

## 🎯 **BENEFITS SUMMARY**

### For You:
- ✅ **Instant results** when re-viewing meals
- ✅ **Cost savings** (~90% reduction in API calls)
- ✅ **Historical tracking** of how meals were rated
- ✅ **Compare analyses** over time (if re-analyzed)

### For Your Data:
- ✅ **Analysis history** preserved
- ✅ **Trend tracking** (score changes over time)
- ✅ **Genomic alignment** documented per meal

---

## 🚨 **REGRESSIONS PREVENTED**

**Checklist Before This Feature:**
- [x] Verified meal logging still works
- [x] Verified fresh analysis still works
- [x] Tested with encrypted database
- [x] Confirmed CASCADE deletion works
- [x] Backend restart successful
- [x] No breaking changes to existing API

**Status:** ✅ **NO REGRESSIONS** - All existing features working

---

## 📞 **USAGE TIPS**

### When to Re-analyze:

**Good Reasons:**
- Added new medications/supplements
- Updated genomic data
- Changed treatment phase
- Want fresh recommendations

**Not Necessary:**
- Just reviewing past meal scores
- Comparing meals
- Tracking nutrition trends

### Performance:

**Fresh Analysis:**
- Time: 2-3 seconds
- Cost: ~$0.001

**Cached Analysis:**
- Time: <100ms (instant)
- Cost: $0.00 (free)

---

## ✅ **VERIFICATION**

**To verify it's working:**

1. **Rate a meal** (first time)
   - Should take 2-3 seconds
   - No "Saved" badge

2. **Rate same meal again**
   - Should be instant
   - Shows "Saved [date]" badge
   - "Re-analyze" button visible

3. **Click Re-analyze**
   - Takes 2-3 seconds
   - Results update
   - Next view still shows "Saved" badge

---

**Feature Status:** ✅ LIVE and WORKING

**Database:** Migration 003 applied  
**Backend:** Restarted with new API  
**Frontend:** Hot-reloaded with new UI  
**Cost Savings:** ~90% on repeated analyses  
**User Experience:** Instant cached results + re-analyze option

---

*Feature implemented by Jor-El*  
*Medical Research Tracker v1.0*  
*February 14, 2026, 7:15 AM EST*
