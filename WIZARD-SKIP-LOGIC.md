# Wizard Skip Logic

## Problem Solved

Users complained that the onboarding wizard kept showing on every launch, even after they'd already set up the app.

## Solution (v0.1.14)

Two-layer check prevents wizard from showing repeatedly:

### Layer 1: Check if User Account Exists
```javascript
const needsSetupResult = await api.needsSetup();

if (!needsSetupResult) {
  // User exists - skip wizard completely
  checkAuth();
  return;
}
```

### Layer 2: Check if Wizard Has Been Shown
```javascript
const wizardCompleted = localStorage.getItem('firstRunWizardCompleted');

if (wizardCompleted === 'true') {
  // Wizard already shown - skip it
  checkAuth();
  return;
}

// First time ever - show wizard
setShowFirstRunWizard(true);
```

## Flow Diagram

```
┌─────────────────────┐
│  App Starts         │
└──────────┬──────────┘
           │
           ▼
    ┌──────────────┐
    │ needsSetup() │
    └──────┬───────┘
           │
      ┌────┴────┐
      │         │
    false     true
      │         │
      ▼         ▼
  ┌────────┐  ┌────────────────────────┐
  │ SKIP   │  │ Check localStorage     │
  │ WIZARD │  │ 'firstRunWizardCompleted' │
  └────────┘  └──────┬─────────────────┘
                     │
                ┌────┴────┐
                │         │
              true      false
                │         │
                ▼         ▼
           ┌────────┐  ┌────────────┐
           │ SKIP   │  │ SHOW       │
           │ WIZARD │  │ WIZARD     │
           └────────┘  └──────┬─────┘
                              │
                              ▼
                       ┌────────────┐
                       │ Complete   │
                       │ Wizard     │
                       └──────┬─────┘
                              │
                              ▼
                     Set localStorage flag
                     'firstRunWizardCompleted' = 'true'
```

## Scenarios

### Scenario 1: First Launch EVER
1. No users exist in database
2. No localStorage flag set
3. **Result:** Show wizard ✅

### Scenario 2: User Skips Wizard (Doesn't Create Account)
1. User clicks "Skip" or closes wizard
2. `localStorage.setItem('firstRunWizardCompleted', 'true')` is set
3. App restarts
4. No users exist in database BUT localStorage flag is set
5. **Result:** Skip wizard, show login/signup screen ✅

### Scenario 3: User Creates Account (Via Wizard or Login Screen)
1. Account exists in database
2. `needsSetup()` returns false
3. **Result:** Skip wizard immediately, show login ✅

### Scenario 4: Regular User (Has Account, Logs In Daily)
1. Account exists in database
2. `needsSetup()` returns false
3. **Result:** Skip wizard, go straight to login ✅

## Why Two Layers?

**Layer 1 (Account Check):** Fast path for existing users  
**Layer 2 (localStorage Flag):** Handles edge case where wizard is shown but no account created

Without Layer 2, the wizard would reappear every time if the user skipped account creation.

## Files Changed

- `src/App.jsx` - Added localStorage check in `checkFirstRun()`
- `src/App.jsx` - Set localStorage flag in `handleFirstRunComplete()`

## Testing

To test the wizard skip logic:

1. **Clear everything:**
   ```bash
   # Clear database
   rm ~/Library/Application\ Support/MyTreatmentPath/health.db
   
   # Clear localStorage
   Open DevTools → Application → Local Storage → Clear
   ```

2. **Test first launch:**
   - Launch app → Should show wizard

3. **Test skip without account:**
   - Complete/skip wizard
   - Quit app
   - Clear database (but NOT localStorage)
   - Launch app → Should NOT show wizard (go to login)

4. **Test with account:**
   - Create account
   - Quit app
   - Launch app → Should NOT show wizard (go to login)

## Persistence

The `localStorage.getItem('firstRunWizardCompleted')` flag persists even if:
- User quits the app
- User restarts computer
- Database is deleted

It only clears if:
- User manually clears browser data
- App data is completely removed
- User manually runs: `localStorage.clear()`

This is intentional - once you've seen the wizard, you don't need to see it again.
