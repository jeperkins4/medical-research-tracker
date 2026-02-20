# MyTreatmentPath - iOS Roadmap

**Vision:** Native iOS app (iPhone + iPad) for bladder cancer research tracking

---

## Executive Summary

**Goal:** Port MyTreatmentPath to iOS while maintaining core features and adding iOS-native capabilities.

**Target Devices:**
- iPhone (iOS 16.0+)
- iPad (iPadOS 16.0+)

**Timeline:** 12-16 weeks (3-4 months)

**Tech Stack Recommendation:** React Native (code reuse from Electron) + Swift for native modules

---

## Phase 1: Architecture Decision (Week 1-2)

### Option A: React Native (RECOMMENDED)
**Pros:**
- ✅ Reuse existing React components (~60% code reuse)
- ✅ Shared business logic (treatments, research scanner)
- ✅ Faster development (familiar stack)
- ✅ Cross-platform (iOS + Android from same codebase)
- ✅ Large community, mature ecosystem

**Cons:**
- ❌ Slightly larger app size vs native
- ❌ Some performance overhead
- ❌ Requires bridging for native features (HealthKit)

**Estimated Dev Time:** 12-14 weeks

---

### Option B: Native Swift + SwiftUI
**Pros:**
- ✅ Best performance
- ✅ Smallest app size
- ✅ Full iOS API access (HealthKit, Shortcuts, Widgets)
- ✅ Best user experience (truly native)

**Cons:**
- ❌ Rewrite entire app from scratch
- ❌ No code reuse from Electron app
- ❌ Longer development time
- ❌ Separate Android version needed later

**Estimated Dev Time:** 20-24 weeks

---

### Option C: Flutter
**Pros:**
- ✅ Cross-platform (iOS + Android)
- ✅ Fast performance (compiled to native)
- ✅ Beautiful UI framework

**Cons:**
- ❌ Zero code reuse (Dart vs TypeScript)
- ❌ Smaller community than React Native
- ❌ Learning curve (new language)

**Estimated Dev Time:** 16-18 weeks

---

**RECOMMENDATION: React Native**
- Best balance of speed, code reuse, and quality
- Can ship iOS in 12-14 weeks
- Android version "free" afterward

---

## Phase 2: Feature Mapping (Week 2-3)

### Features That Work As-Is
✅ **User Authentication**
- Local SQLite → iOS Core Data or Realm
- Biometric login (Face ID / Touch ID) - iOS bonus

✅ **Treatment Tracking**
- Timeline view works on mobile
- Add iOS Calendar integration

✅ **Research Library**
- List view works well on mobile
- Swipe actions for save/delete (iOS native gesture)

✅ **Genomic Reports**
- Upload from Files app
- View PDFs in native iOS viewer

✅ **PHI Encryption**
- AES-256-GCM works on iOS
- Can use iOS Keychain for secrets

---

### Features That Need Adaptation

⚠️ **Research Scanner (Cron Jobs)**
- **Desktop:** Runs at 2 AM via macOS cron
- **iOS:** Background tasks limited (15 min max)
- **Solution:** 
  - Push notifications trigger user to run scan
  - Or: Backend service runs scans, pushes results to app
  - Or: On-demand scanning only (user-initiated)

⚠️ **Data Storage**
- **Desktop:** ~/Library/Application Support/
- **iOS:** App sandbox (Documents/ or Application Support/)
- **Solution:** 
  - Core Data or Realm database
  - iCloud sync optional (user choice)

⚠️ **File Uploads**
- **Desktop:** File picker, drag-and-drop
- **iOS:** Document picker, camera, or iCloud Drive
- **Solution:** UIDocumentPickerViewController

⚠️ **Large Database**
- **Desktop:** No size limits
- **iOS:** Limited storage on device
- **Solution:** 
  - Pagination for large datasets
  - Archive old data option

---

### iOS-Specific Features (Bonus)

🎁 **HealthKit Integration**
- Import medication logs
- Track side effects (symptoms)
- Export treatment data to Health app
- Share with doctors via Health Records

🎁 **Shortcuts Integration**
- "Log Treatment" Siri shortcut
- "Check Latest Research" shortcut
- "Export Health Data" shortcut

🎁 **Widgets**
- Today's treatments widget
- Latest research widget
- Upcoming appointments widget

🎁 **Apple Watch Companion**
- Log medication doses
- Track side effects
- View today's schedule

🎁 **iPad-Specific**
- Split-view: Research on left, notes on right
- Pencil support for annotations on genomic reports
- Drag-and-drop between apps

---

## Phase 3: Technical Architecture (Week 3-4)

### Frontend (React Native)
```
mytreatmentpath-ios/
├── src/
│   ├── screens/
│   │   ├── Auth/
│   │   │   ├── LoginScreen.tsx
│   │   │   └── SignupScreen.tsx
│   │   ├── Treatments/
│   │   │   ├── TreatmentListScreen.tsx
│   │   │   ├── TreatmentDetailScreen.tsx
│   │   │   └── AddTreatmentScreen.tsx
│   │   ├── Research/
│   │   │   ├── ResearchListScreen.tsx
│   │   │   ├── ResearchDetailScreen.tsx
│   │   │   └── ScannerScreen.tsx
│   │   ├── Genomics/
│   │   │   ├── GenomicReportsScreen.tsx
│   │   │   ├── UploadReportScreen.tsx
│   │   │   └── MutationDetailScreen.tsx
│   │   └── Settings/
│   │       ├── SettingsScreen.tsx
│   │       ├── PrivacyScreen.tsx
│   │       └── ExportDataScreen.tsx
│   ├── components/
│   │   ├── TreatmentCard.tsx
│   │   ├── ResearchCard.tsx
│   │   ├── Timeline.tsx
│   │   └── GenomicViewer.tsx
│   ├── services/
│   │   ├── database.ts (Realm or WatermelonDB)
│   │   ├── encryption.ts (AES-256-GCM)
│   │   ├── researchScanner.ts
│   │   └── healthKit.ts (native bridge)
│   ├── navigation/
│   │   └── AppNavigator.tsx (React Navigation)
│   └── utils/
│       ├── biometrics.ts (Face ID / Touch ID)
│       └── notifications.ts
├── ios/ (native iOS modules)
│   ├── HealthKitBridge.swift
│   ├── BiometricAuth.swift
│   └── FileEncryption.swift
└── android/ (future)
```

### Backend Strategy

**Option A: Fully Local (Desktop Parity)**
- ✅ No server costs
- ✅ True privacy (data never leaves device)
- ❌ No background research scanning
- ❌ No cross-device sync

**Option B: Optional Cloud Sync**
- ✅ Sync between iPhone/iPad/Mac
- ✅ Background research scanning
- ✅ Backup to iCloud
- ❌ Requires backend infrastructure
- ❌ Privacy implications

**Option C: Hybrid**
- ✅ Local-first (works offline)
- ✅ Optional iCloud sync (user choice)
- ✅ Push notifications for research updates
- ✅ Best of both worlds

**RECOMMENDATION: Option C (Hybrid)**
- Default: Fully local
- User opt-in: iCloud sync
- Push notifications via APNs (free)

---

## Phase 4: Development Phases (Week 4-14)

### Sprint 1: Foundation (Week 4-5)
- [ ] React Native project setup
- [ ] Navigation structure (React Navigation)
- [ ] Database (Realm or WatermelonDB)
- [ ] Authentication (local + biometric)
- [ ] Basic UI components

**Deliverable:** Login screen + empty app shell

---

### Sprint 2: Core Features (Week 6-8)
- [ ] Treatment tracking (CRUD)
- [ ] Timeline view
- [ ] Research library (list + detail)
- [ ] Search and filter
- [ ] SQLite → Realm migration plan

**Deliverable:** MVP with treatments + research

---

### Sprint 3: Genomics (Week 9-10)
- [ ] Upload genomic reports (PDF)
- [ ] Parse mutations (Foundation One format)
- [ ] Mutation detail views
- [ ] Treatment recommendations based on mutations

**Deliverable:** Genomic report management

---

### Sprint 4: Research Scanner (Week 11)
- [ ] On-demand research scanning
- [ ] Brave Search API integration
- [ ] Push notifications for new research
- [ ] Background fetch (iOS limits)

**Deliverable:** Research discovery feature

---

### Sprint 5: iOS-Native Features (Week 12)
- [ ] HealthKit integration (optional)
- [ ] Siri Shortcuts
- [ ] Today widget
- [ ] Face ID / Touch ID
- [ ] iCloud sync (optional)

**Deliverable:** iOS-specific enhancements

---

### Sprint 6: iPad Optimization (Week 13)
- [ ] Split-view layouts
- [ ] Drag-and-drop support
- [ ] Pencil annotations
- [ ] Keyboard shortcuts
- [ ] Multitasking support

**Deliverable:** iPad-optimized experience

---

### Sprint 7: Testing & Polish (Week 14)
- [ ] TestFlight beta testing
- [ ] Bug fixes
- [ ] Performance optimization
- [ ] Accessibility (VoiceOver, Dynamic Type)
- [ ] App Store assets (screenshots, description)

**Deliverable:** Release candidate

---

## Phase 5: App Store Submission (Week 15-16)

### App Store Requirements

**Privacy:**
- [ ] Privacy Policy URL (required)
- [ ] Data collection disclosure
- [ ] Privacy Nutrition Labels
- [ ] HIPAA compliance statement (if applicable)

**Content:**
- [ ] App name: "MyTreatmentPath"
- [ ] Subtitle: "Bladder Cancer Research Tracker"
- [ ] Category: Medical
- [ ] Age rating: 17+ (medical content)

**Screenshots:**
- [ ] 6.7" iPhone (iPhone 15 Pro Max)
- [ ] 6.5" iPhone (iPhone 11 Pro Max)
- [ ] 12.9" iPad Pro
- [ ] App icon (1024x1024)
- [ ] Launch screen

**Review Prep:**
- [ ] Demo video for reviewers
- [ ] Test account credentials
- [ ] Medical disclaimer prominent
- [ ] HIPAA compliance documentation

**Estimated Review Time:** 1-3 days (Apple)

---

## Phase 6: Post-Launch (Ongoing)

### Version 1.1 (1 month after launch)
- [ ] Bug fixes from user feedback
- [ ] Performance improvements
- [ ] Additional mutations support
- [ ] More genomic report formats

### Version 1.2 (2 months)
- [ ] Apple Watch companion app
- [ ] Advanced widgets (interactive)
- [ ] Medication reminders
- [ ] Doctor appointment tracking

### Version 1.3 (3 months)
- [ ] Social features (anonymous patient community)
- [ ] Clinical trial matching
- [ ] Export to PDF for doctors
- [ ] Multi-language support

### Version 2.0 (6 months)
- [ ] Android version (React Native reuse)
- [ ] Web companion dashboard
- [ ] Family sharing (caregivers)
- [ ] Voice logging (Siri integration)

---

## Technical Challenges & Solutions

### Challenge 1: Background Research Scanning
**Problem:** iOS limits background tasks to 15 minutes  
**Solution:**
- Push notifications prompt user to run scan
- Or: Move scanning to cloud backend (optional)
- Or: On-demand only (user-initiated)

### Challenge 2: Large Database Size
**Problem:** iPhones have limited storage  
**Solution:**
- Pagination for large datasets
- Archive old data to iCloud
- Lazy loading of research articles

### Challenge 3: PHI Security on iOS
**Problem:** Encryption key storage  
**Solution:**
- Use iOS Keychain (hardware-encrypted)
- Biometric authentication required
- Auto-lock after 5 minutes idle

### Challenge 4: Cross-Device Sync
**Problem:** Mac → iPhone data transfer  
**Solution:**
- Export/import via AirDrop
- Or: iCloud CloudKit sync
- Or: QR code transfer (encrypted payload)

### Challenge 5: App Store Review
**Problem:** Medical apps face strict review  
**Solution:**
- Clear disclaimer: "Not medical advice"
- Prominent "Consult your oncologist" messaging
- Privacy policy and HIPAA statement
- Demo video showing intended use

---

## Cost Analysis

### Development Costs
- **Developer time:** 12-14 weeks @ $100/hr = $48k-56k (if outsourced)
- **Apple Developer Program:** $99/year
- **App Store assets:** $500-1,000 (design)
- **TestFlight beta testing:** Free
- **Backend (if cloud sync):** $0-50/month (Firebase/Supabase)

**Total (DIY):** $599 (just Apple membership)  
**Total (Outsourced):** $49k-57k

---

### Revenue Model Options

**Option 1: Free (Ad-Supported)**
- ❌ Conflicts with privacy messaging
- ❌ Inappropriate for medical apps

**Option 2: Free (Freemium)**
- ✅ Basic features free
- ✅ Premium: $4.99/month or $29.99/year
- Premium features: iCloud sync, HealthKit, Widgets, Apple Watch

**Option 3: Paid App**
- ✅ One-time purchase: $9.99
- ✅ No subscriptions
- ❌ Higher barrier to entry

**Option 4: Donation-Based**
- ✅ Free to download
- ✅ Optional "tip jar" for support
- ✅ Aligns with mission (help patients)

**RECOMMENDATION: Option 2 (Freemium)**
- Free core features (treatments, research)
- Premium for sync, widgets, HealthKit ($29.99/year)

---

## Success Metrics

### Phase 1 (Launch)
- 100 downloads in first week
- 50 active users in first month
- 4.0+ star rating on App Store
- <5% crash rate

### Phase 2 (Growth)
- 1,000 downloads in 3 months
- 500 active users
- 10+ App Store reviews (4.5+ stars)
- Featured by Apple (aspirational)

### Phase 3 (Scale)
- 10,000 downloads in 6 months
- 5,000 active users
- Press coverage (Bladder Cancer Advocacy Network)
- Partnerships with cancer centers

---

## Risk Mitigation

### Risk 1: App Store Rejection
**Mitigation:**
- Clear medical disclaimer
- Privacy policy compliance
- HIPAA statement
- Demo video for reviewers

### Risk 2: Limited iOS Background Tasks
**Mitigation:**
- Push notifications for research updates
- On-demand scanning
- Or: Cloud backend for scanning

### Risk 3: Development Time Overrun
**Mitigation:**
- MVP-first approach (core features only)
- Use React Native (code reuse)
- Defer iPad/Watch to v1.1+

### Risk 4: User Adoption
**Mitigation:**
- Launch on Product Hunt
- Post to BCAN, r/bladder_cancer
- Press outreach (TechCrunch, Wired Health)
- Doctor referrals

---

## Next Steps (Don't Start Yet!)

**When ready to begin:**

1. **Finalize tech stack decision** (React Native vs Swift)
2. **Set up React Native project** (`npx react-native init`)
3. **Design iOS mockups** (Figma or Sketch)
4. **Create GitHub project board** (track sprints)
5. **Register Apple Developer account** ($99)
6. **Start Sprint 1: Foundation** (Week 4-5)

---

## Open Questions (To Answer Before Starting)

1. **React Native or Native Swift?** (Lean React Native for speed)
2. **Cloud sync or local-only?** (Recommend hybrid: local + optional iCloud)
3. **Background scanning or on-demand?** (Recommend on-demand + push notifications)
4. **Free or freemium?** (Recommend freemium: free core, $29.99/year premium)
5. **Launch iPad version at same time or later?** (Recommend later - iPhone first)

---

## Timeline Summary

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Architecture Decision | 2 weeks | Tech stack chosen |
| Feature Mapping | 1 week | Feature parity plan |
| Foundation Setup | 2 weeks | App shell + auth |
| Core Features | 3 weeks | Treatments + research |
| Genomics | 2 weeks | Report uploads + mutations |
| Research Scanner | 1 week | On-demand scanning |
| iOS-Native Features | 1 week | HealthKit, Shortcuts, widgets |
| iPad Optimization | 1 week | Split-view, Pencil support |
| Testing & Polish | 1 week | Bug fixes, performance |
| App Store Submission | 2 weeks | Review + launch |
| **TOTAL** | **16 weeks** | **iOS app live** |

---

**Estimated Launch Date:** 4 months from start (June 2026 if starting March)

---

## Conclusion

**MyTreatmentPath for iOS is feasible and valuable.**

**Best Path Forward:**
1. Ship Mac app first (already done! ✅)
2. Build React Native iOS app (12-14 weeks)
3. Launch on App Store (free + freemium)
4. Android version later (React Native reuse)

**The iOS app will:**
- ✅ Reach mobile users (larger audience than Mac)
- ✅ Integrate with HealthKit (iOS bonus)
- ✅ Support widgets, Shortcuts, Apple Watch
- ✅ Maintain privacy-first approach
- ✅ Reuse 60% of codebase (React Native)

**This roadmap is ready. Just say the word and we'll start building.** 🚀

---

**Next Action:** Review this roadmap, make decisions on open questions, then we can start Sprint 1.
