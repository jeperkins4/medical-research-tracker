# Medication Manager - UI Flow Guide

Visual walkthrough of the new medication/supplement management system.

---

## Main Screen

```
╔══════════════════════════════════════════════════════════════╗
║  💊 Medications & Supplements                                ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  [All (12) ▼]    [+ Add Medication/Supplement]             ║
║                                                              ║
║  📚 Quick Add (From Evidence Database)                       ║
║  ┌────────────────────────────────────────────────────────┐ ║
║  │ [+ Curcumin]  [+ EGCG]  [+ Berberine]                  │ ║
║  │ [+ Fenbendazole]  [+ Ivermectin]  [+ LDN]             │ ║
║  └────────────────────────────────────────────────────────┘ ║
║                                                              ║
║  ┌─────────────────────────────────────────────────────────┐║
║  │ Curcumin                          [Supplement]          │║
║  │                                                          │║
║  │ Dosage: 1000mg                                          │║
║  │ Frequency: Daily with meals                             │║
║  │ Started: Feb 1, 2026                                    │║
║  │ Reason: Target ARID1A mutation / HIF-1α pathway         │║
║  │                                                          │║
║  │ [📚 View Research]  [✏️ Edit]  [🗑️ Delete]              │║
║  └─────────────────────────────────────────────────────────┘║
║                                                              ║
║  ┌─────────────────────────────────────────────────────────┐║
║  │ Padcev                           [Prescription]         │║
║  │                                                          │║
║  │ Dosage: 125mg                                           │║
║  │ Frequency: IV infusion every 3 weeks                    │║
║  │ Started: Jan 15, 2026                                   │║
║  │ Prescribed by: Dr. Tien Do                              │║
║  │                                                          │║
║  │ [📚 View Research]  [✏️ Edit]  [🗑️ Delete]              │║
║  └─────────────────────────────────────────────────────────┘║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```

---

## Add Medication Form

```
╔══════════════════════════════════════════════════════════════╗
║  Add New Medication/Supplement                               ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  Name *                                                      ║
║  ┌──────────────────────────────────────────────────────┐   ║
║  │ Curcumin                                     [▼]     │   ║
║  │ ┌────────────────────────────────────────┐          │   ║
║  │ │ Curcumin                               │          │   ║
║  │ │ Green Tea Extract (EGCG)               │          │   ║
║  │ │ Berberine                              │          │   ║
║  │ └────────────────────────────────────────┘          │   ║
║  └──────────────────────────────────────────────────────┘   ║
║                                                              ║
║  Type *              Dosage              Frequency           ║
║  ┌────────────┐      ┌────────────┐     ┌─────────────┐    ║
║  │Supplement▼ │      │ 1000mg     │     │ Daily       │    ║
║  └────────────┘      └────────────┘     └─────────────┘    ║
║                                                              ║
║  Started             Stopped              [✓] Currently     ║
║  ┌────────────┐      ┌────────────┐          Active        ║
║  │ 2026-02-01 │      │            │                         ║
║  └────────────┘      └────────────┘                         ║
║                                                              ║
║  Reason / Indication                                         ║
║  ┌──────────────────────────────────────────────────────┐   ║
║  │ Target ARID1A mutation and HIF-1α pathway            │   ║
║  └──────────────────────────────────────────────────────┘   ║
║                                                              ║
║  📊 Evidence Available                                       ║
║  ┌──────────────────────────────────────────────────────┐   ║
║  │ Strength: Strongly Supported - HIGH PRIORITY          │   ║
║  │ Target Pathways: Hypoxia/HIF1, Cancer Stem Cells      │   ║
║  │ Research Articles: 4 studies will be added            │   ║
║  │                    automatically                       │   ║
║  └──────────────────────────────────────────────────────┘   ║
║                                                              ║
║  [Add Medication]  [Cancel]                                 ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```

**Key Features:**
- Autocomplete with evidence database
- Real-time evidence preview
- Auto-populates mechanism, pathways, dosing
- Research articles added automatically on submit

---

## Research Evidence Modal

```
╔══════════════════════════════════════════════════════════════╗
║  📚 Research Evidence: Curcumin                      [✕]    ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  Evidence Strength: Strongly Supported - HIGH PRIORITY      ║
║  Target Pathways: Hypoxia/HIF1 Signaling, Cancer Stem       ║
║                   Cells, ARID1A Mutation                     ║
║                                                              ║
║  🎯 Genomic Alignment:                                       ║
║  ┌──────────────────────────────────────────────────────┐   ║
║  │ PERFECT FIT: Your ARID1A mutation causes HIF-1α       │   ║
║  │ pathway hyperactivation → cancer stem cells →         │   ║
║  │ treatment resistance. Curcumin directly blocks        │   ║
║  │ HIF-1α by degrading ARNT, targeting the root cause   │   ║
║  │ of your cancer stem cell population.                  │   ║
║  └──────────────────────────────────────────────────────┘   ║
║                                                              ║
║  Research Articles (4)                                       ║
║  ┌──────────────────────────────────────────────────────┐   ║
║  │ Curcumin Inhibits HIF-1 by Degrading ARNT            │   ║
║  │ https://www.sciencedirect.com/science/article/...    │   ║
║  │ (2021)                                                │   ║
║  │                                                        │   ║
║  │ Curcumin inhibited the expression of HIF-1 by         │   ║
║  │ degrading ARNT in cancer stem-like cells, thereby     │   ║
║  │ improving the hypoxia environment and promoting       │   ║
║  │ early apoptosis of breast cancer cells.               │   ║
║  │                                                        │   ║
║  │ [Supporting]                                           │   ║
║  └──────────────────────────────────────────────────────┘   ║
║                                                              ║
║  ┌──────────────────────────────────────────────────────┐   ║
║  │ Curcumin Inhibits Bladder Cancer Stem Cells via       │   ║
║  │ Sonic Hedgehog Pathway                                │   ║
║  │ https://pubmed.ncbi.nlm.nih.gov/28870814/            │   ║
║  │ (2017)                                                │   ║
║  │                                                        │   ║
║  │ Curcumin exerts potent anticancer activities by       │   ║
║  │ inhibiting bladder cancer stem cells through          │   ║
║  │ suppression of the Sonic Hedgehog pathway.            │   ║
║  │                                                        │   ║
║  │ [Supporting]                                           │   ║
║  └──────────────────────────────────────────────────────┘   ║
║                                                              ║
║  ┌──────────────────────────────────────────────────────┐   ║
║  │ ARID1A Mutations Drive Bladder Cancer Stem Cells      │   ║
║  │ https://www.nature.com/articles/cddis2017452         │   ║
║  │ (2017)                                                │   ║
║  │                                                        │   ║
║  │ Single-cell sequencing reveals variants in ARID1A     │   ║
║  │ driving self-renewal of human bladder cancer stem     │   ║
║  │ cells. Curcumin reversed chronic tobacco smoke        │   ║
║  │ exposure induced EMT and acquisition of cancer        │   ║
║  │ stem cell properties.                                 │   ║
║  │                                                        │   ║
║  │ [Mechanism]                                            │   ║
║  └──────────────────────────────────────────────────────┘   ║
║                                                              ║
║  [+ Add Research Article]                                   ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```

**Key Features:**
- Genomic alignment explanation
- Clickable article links (open in new tab)
- Article categorization (supporting, warning, mechanism)
- Add custom articles button

---

## Filter States

### All Medications (Default)
Shows both prescription drugs and supplements together.

```
[All (12) ▼]
  Curcumin                    [Supplement]
  Padcev                      [Prescription]
  EGCG                        [Supplement]
  Eliquis                     [Prescription]
  Berberine                   [Supplement]
```

### Prescriptions Only
```
[Prescription (4) ▼]
  Padcev                      [Prescription]
  Eliquis                     [Prescription]
  Pendulum                    [Prescription]
  Keytruda                    [Prescription]
```

### Supplements Only
```
[Supplements (8) ▼]
  Curcumin                    [Supplement]
  EGCG                        [Supplement]
  Berberine                   [Supplement]
  Vitamin C IV                [Integrative]
  LDN                         [Integrative]
```

---

## Color Coding

**Prescription:**
- Badge: Blue background, dark blue text
- `background: #dbeafe; color: #1e40af;`

**Supplement:**
- Badge: Green background, dark green text
- `background: #dcfce7; color: #15803d;`

**OTC (Over-the-Counter):**
- Badge: Yellow background, brown text
- `background: #fef3c7; color: #92400e;`

**Integrative:**
- Badge: Purple background, dark purple text
- `background: #f3e8ff; color: #6b21a8;`

**Inactive (Stopped):**
- Card: Gray background, reduced opacity
- Badge: Red "Stopped" badge
- `background: #fee2e2; color: #991b1b;`

---

## Article Type Badges

**Supporting:**
- Green badge: `#dcfce7` / `#15803d`
- Studies showing benefits

**Warning:**
- Red badge: `#fee2e2` / `#991b1b`
- Potential risks, contraindications

**Mechanism:**
- Blue badge: `#dbeafe` / `#1e40af`
- How it works scientifically

**Clinical Trial:**
- Purple badge: `#f3e8ff` / `#6b21a8`
- Clinical trial data

---

## Responsive Design

**Desktop:**
- 2-column form layout
- Side-by-side medication cards
- Wide research modal (800px max)

**Tablet:**
- Single-column form
- Stacked medication cards
- Full-width modal

**Mobile:**
- Single-column everything
- Full-width buttons
- Touch-optimized spacing

---

## User Flow Examples

### Example 1: Adding Curcumin (Quick)

1. Click "💊 Medications & Supplements" tab
2. Click "[+ Curcumin]" quick-add button
3. Form opens pre-filled with name
4. Fill in dosage: "1000mg"
5. Fill in frequency: "Daily with meals"
6. Click "Add Medication"
7. **DONE!** 4 research articles automatically added

**Time:** ~30 seconds

### Example 2: Adding Padcev (Manual)

1. Click "+ Add Medication/Supplement"
2. Type "Padcev" (no autocomplete, not in evidence DB)
3. Select Type: "Prescription"
4. Dosage: "125mg"
5. Frequency: "IV infusion every 3 weeks"
6. Started: "2026-01-15"
7. Prescribed by: "Dr. Tien Do"
8. Reason: "Bladder cancer treatment"
9. Click "Add Medication"
10. Later: Click "📚 View Research" → "+ Add Research Article" to manually add clinical trial data

**Time:** ~2 minutes

### Example 3: Viewing Research

1. Click "📚 View Research" on Curcumin card
2. Modal opens showing:
   - Evidence strength
   - Target pathways
   - Genomic alignment explanation
   - 4 research articles with links
3. Click article link → Opens PubMed in new tab
4. Click "✕" to close modal

**Time:** ~1 minute to review

---

## Search Flow (Future)

```
[🔍 Search...]
  Type: "cancer stem"
  Results:
    - Curcumin (targets cancer stem cells)
    - EGCG (inhibits cancer stem cell markers)
```

---

## Dose Tracking Flow (Future)

```
Daily Checklist:
  [✓] Curcumin - 1000mg (Morning)
  [✓] EGCG - 400mg (Morning)
  [ ] Berberine - 500mg (Evening) [Mark Taken]
  
Adherence: 87% this week
```

---

This UI makes complex medication management simple and research-backed. 💊📚
