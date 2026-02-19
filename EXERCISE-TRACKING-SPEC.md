# Exercise Tracking Feature Spec

## 🎯 Goal
Add exercise/physical activity tracking to Medical Research Tracker, integrating with existing health data.

## Why Exercise Matters for Cancer Patients

**Research shows:**
- Reduces treatment side effects (fatigue, neuropathy)
- Improves cancer survival rates
- Maintains muscle mass during chemo
- Reduces recurrence risk
- Improves mental health and QoL

**For bladder cancer specifically:**
- May reduce progression risk
- Improves surgical outcomes
- Helps manage treatment toxicities

---

## Features to Build

### 1. Exercise Log (Core)

**Track:**
- Type: Cardio, Strength, Flexibility, Sports, Other
- Duration: Minutes
- Intensity: Light, Moderate, Vigorous
- Notes: Optional description
- Date/Time: When performed

**Example entries:**
- "30 min brisk walk - Moderate intensity"
- "20 min yoga - Light intensity"
- "Strength training - 45 min - Vigorous"

### 2. Weekly Summary

**Show:**
- Total minutes this week
- Days active (goal: 5+ days/week)
- Intensity breakdown (light/moderate/vigorous)
- Trend chart (compare to previous weeks)

**Guidelines (per oncology research):**
- Target: 150+ min/week moderate activity
- Or: 75+ min/week vigorous activity
- Strength training: 2+ days/week

### 3. Integration with Existing Data

**Correlate exercise with:**
- **Vitals:** Does BP/HR improve on active weeks?
- **Symptoms:** Does fatigue decrease with exercise?
- **Labs:** Track inflammatory markers (CRP)
- **Treatment cycles:** Exercise tolerance during chemo weeks vs. recovery weeks

**Insights:**
- "Your fatigue scores are 30% lower on weeks with 150+ min activity"
- "Blood pressure averages 10 points lower on active weeks"
- "Most active during recovery weeks (week 3-4 of cycle)"

### 4. Smart Recommendations

**Context-aware suggestions:**
- **During chemo week:** "Light walking 10-15 min recommended"
- **Recovery week:** "Resume moderate intensity if energy permits"
- **Low platelet count:** "Avoid contact sports, stick to walking/yoga"
- **Neuropathy flare:** "Try seated exercises or swimming"

### 5. Activity Types

**Pre-defined categories:**
- 🚶 Walking/Hiking
- 🏃 Running/Jogging
- 🚴 Cycling
- 🏊 Swimming
- 🧘 Yoga/Stretching
- 💪 Strength Training
- ⚽ Sports (specify)
- 🏋️ Physical Therapy
- 🎾 Recreational Activities
- 🏃‍♂️ Other Cardio

### 6. Export for Doctors

**PDF report includes:**
- Weekly activity summary
- Correlation with symptoms/vitals
- Treatment cycle alignment
- Activity trends over 3/6/12 months

---

## Database Schema

```sql
-- Exercise log table
CREATE TABLE IF NOT EXISTS exercise_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  time TEXT,
  activity_type TEXT NOT NULL, -- walking, cycling, strength, yoga, etc.
  duration_minutes INTEGER NOT NULL,
  intensity TEXT CHECK(intensity IN ('light', 'moderate', 'vigorous')),
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Exercise goals
CREATE TABLE IF NOT EXISTS exercise_goals (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  weekly_minutes_target INTEGER DEFAULT 150,
  days_per_week_target INTEGER DEFAULT 5,
  strength_days_target INTEGER DEFAULT 2,
  notes TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Activity type preferences (for quick-add)
CREATE TABLE IF NOT EXISTS activity_favorites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  activity_type TEXT UNIQUE NOT NULL,
  default_duration INTEGER,
  default_intensity TEXT,
  sort_order INTEGER DEFAULT 0
);
```

---

## UI Mockup

### Exercise Tab

```
┌─────────────────────────────────────────────────────────┐
│ 🏃 Exercise & Activity                                  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  This Week: 120 / 150 min  ━━━━━━━━░░ 80%              │
│  Days Active: 4 / 5        ⭐⭐⭐⭐☆                     │
│                                                          │
├─────────────────────────────────────────────────────────┤
│  Quick Add (Favorites)                                  │
│  [🚶 30min Walk]  [🧘 20min Yoga]  [💪 Strength 45min] │
│                                                          │
│  [+ Log Exercise]                                       │
├─────────────────────────────────────────────────────────┤
│  Recent Activity                                        │
│                                                          │
│  📅 Today, 2/19/2026                                    │
│  🚶 Morning walk - 30 min (Moderate)                   │
│     "Felt good, no fatigue"                            │
│                                                          │
│  📅 Yesterday, 2/18/2026                                │
│  🧘 Yoga - 20 min (Light)                              │
│  💪 Strength training - 45 min (Moderate)              │
│                                                          │
│  📅 2/17/2026                                           │
│  🚴 Cycling - 25 min (Moderate)                        │
└─────────────────────────────────────────────────────────┘
```

### Log Exercise Modal

```
┌─────────────────────────────────────┐
│ Log Exercise                        │
├─────────────────────────────────────┤
│ Activity Type: [Walking ▼]         │
│ Duration: [30] minutes             │
│ Intensity: ○ Light                 │
│            ● Moderate              │
│            ○ Vigorous              │
│ Date: [2/19/2026]                  │
│ Time: [10:30 AM]                   │
│ Notes: [Optional...]               │
│                                     │
│ [Cancel]  [Save Exercise]          │
└─────────────────────────────────────┘
```

---

## Data Integrations

### Correlate with Vitals
```sql
-- Exercise vs. Blood Pressure
SELECT 
  DATE(v.date) as date,
  AVG(v.systolic) as avg_bp,
  SUM(e.duration_minutes) as total_exercise
FROM vitals v
LEFT JOIN exercise_log e ON DATE(v.date) = DATE(e.date)
GROUP BY DATE(v.date)
ORDER BY date DESC;
```

### Correlate with Symptoms
```sql
-- Exercise vs. Fatigue
SELECT 
  DATE(s.date) as date,
  s.description,
  s.severity,
  SUM(e.duration_minutes) as exercise_mins
FROM symptoms s
LEFT JOIN exercise_log e ON DATE(s.date) = DATE(e.date)
WHERE s.description LIKE '%fatigue%'
GROUP BY DATE(s.date);
```

### Treatment Cycle Analysis
```sql
-- Exercise during chemo weeks vs. recovery weeks
-- (Assumes 4-week cycles: week 1 = chemo, weeks 2-4 = recovery)
-- Would need treatment schedule tracking for full implementation
```

---

## Insights & Analytics

### Weekly Report Example

```
📊 Exercise Summary - Week of 2/12/2026

✅ Total Activity: 165 minutes (Goal: 150)
✅ Days Active: 5 of 7
✅ Strength Training: 2 sessions

Activity Breakdown:
  Walking:   90 min (55%)
  Yoga:      45 min (27%)
  Strength:  30 min (18%)

Intensity:
  Light:     45 min (27%)
  Moderate: 120 min (73%)
  Vigorous:   0 min (0%)

💡 Insights:
  • Your blood pressure averaged 8 mmHg lower on active days
  • No fatigue logged on days with 30+ min activity
  • Most active mid-week (Wed-Fri)

🎯 Next Week:
  • Try adding 1 vigorous session (10-15 min)
  • Consider strength training on Tuesday
```

---

## Implementation Phases

### Phase 1: Basic Tracking (Week 1)
- Database schema
- Add exercise log entry
- View recent activity
- Simple weekly total

### Phase 2: Quick Add & Favorites (Week 1)
- Favorite activity buttons
- Default duration/intensity
- One-tap logging

### Phase 3: Goals & Progress (Week 2)
- Weekly goal tracking
- Progress indicators
- Days active counter
- Streak tracking

### Phase 4: Analytics (Week 2-3)
- Weekly summary reports
- Intensity breakdown charts
- Activity type distribution
- Trend analysis

### Phase 5: Smart Correlations (Week 3-4)
- Link to vitals data
- Link to symptoms
- Treatment cycle awareness
- Personalized insights

### Phase 6: Export & Sharing (Week 4)
- PDF reports for doctors
- CSV export
- Chart visualizations
- Treatment timeline overlay

---

## Mobile Considerations

**Quick logging is key:**
- One-tap "Log Walk" from home screen
- Voice input: "Log 30 minute walk"
- Auto-detect via Apple Health/Google Fit integration (future)

---

## Privacy & HIPAA

**Exercise data is PHI:**
- Stays encrypted in local SQLite
- Not synced to Supabase (unless user opts in)
- Included in encrypted backups
- Audit log for access

**Exception:**
- Generic activity types OK to sync (walking, cycling)
- No medical context (e.g., "post-chemo fatigue walk")

---

## Research Citations to Add

**JAMA article provided by user:**
- [Title TBD - awaiting user input]
- URL: https://jamanetwork.com/journals/jamanetworkopen/fullarticle/2845149
- Topic: Exercise and cancer outcomes

**Other key studies:**
- Exercise guidelines for cancer survivors (ASCO)
- Physical activity and bladder cancer outcomes
- Exercise during chemotherapy safety

---

## Next Steps

1. **Get article details from user** (title, summary)
2. **Create database migration** (013-exercise-tracking.sql)
3. **Build React component** (ExerciseTracker.jsx)
4. **Add API routes** (exercise-routes.js)
5. **Test with sample data**
6. **Integrate with existing vitals/symptoms**
7. **Build analytics dashboard**

---

**Ready to build as soon as you provide the JAMA article details!** 🏃‍♂️
