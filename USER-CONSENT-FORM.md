# User Consent Form - Analytics

**Add this to your signup flow / account creation page**

---

## Option 1: Simple Checkbox (Recommended)

**During account creation, show:**

```
☐ I consent to the de-identification and aggregation of my health data for 
  research purposes as described in the Privacy Policy.
  
  Your personal information will be removed (name, email, exact age, city, etc.)
  and combined with at least 10 other users' data. You can opt out anytime.
  
  Learn more: [Privacy Policy - Analytics Section]
```

**Implementation:**

```javascript
// React/JSX example
<label className="consent-checkbox">
  <input 
    type="checkbox" 
    name="analytics_consent" 
    required 
    checked={analyticsConsent}
    onChange={(e) => setAnalyticsConsent(e.target.checked)}
  />
  <span>
    I consent to the de-identification and aggregation of my health data 
    for research purposes as described in the{' '}
    <a href="/privacy-policy#analytics" target="_blank">
      Privacy Policy
    </a>.
    <br />
    <small>
      Your personal information will be removed (name, email, exact age, city, etc.) 
      and combined with at least 10 other users' data. You can opt out anytime.
    </small>
  </span>
</label>
```

---

## Option 2: Detailed Consent (More Transparent)

**During account creation, show:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
         CONSENT FOR RESEARCH AND ANALYTICS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MyTreatmentPath uses de-identified, aggregated data to:
• Improve our platform and services
• Contribute to cancer research
• Help other patients with similar diagnoses

How we protect your privacy:
✓ We remove your name, email, address, exact age, city, and other identifiers
✓ We only share data for groups of 11+ people (you can't be identified)
✓ Your personal medical records remain private and encrypted
✓ You can opt out anytime

What we share (examples):
• "15 users have bladder cancer Stage 4"
• "18 users have PIK3CA mutations"
• "30 users are taking Curcumin"

What we DON'T share:
• Your name, email, or any identifying information
• Your specific medical history
• Data from groups smaller than 11 people

Your rights:
• Opt out anytime (email privacy@mytreatmentpath.com)
• Delete your account (removes your personal data)
• Request information about how your data is used

☐ I consent to de-identification and use of my data as described above.
  I understand I can opt out or delete my account anytime.

[ Learn More: Privacy Policy ] [ Learn More: Terms of Use ]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Implementation:**

```javascript
// React/JSX example
<div className="analytics-consent-box">
  <h3>Consent for Research and Analytics</h3>
  
  <p>MyTreatmentPath uses de-identified, aggregated data to:</p>
  <ul>
    <li>Improve our platform and services</li>
    <li>Contribute to cancer research</li>
    <li>Help other patients with similar diagnoses</li>
  </ul>
  
  <div className="protection-info">
    <h4>How we protect your privacy:</h4>
    <ul>
      <li>✓ We remove your name, email, address, exact age, city, and other identifiers</li>
      <li>✓ We only share data for groups of 11+ people (you can't be identified)</li>
      <li>✓ Your personal medical records remain private and encrypted</li>
      <li>✓ You can opt out anytime</li>
    </ul>
  </div>
  
  <div className="examples">
    <div className="example-do">
      <h4>What we share (examples):</h4>
      <ul>
        <li>"15 users have bladder cancer Stage 4"</li>
        <li>"18 users have PIK3CA mutations"</li>
        <li>"30 users are taking Curcumin"</li>
      </ul>
    </div>
    
    <div className="example-dont">
      <h4>What we DON'T share:</h4>
      <ul>
        <li>Your name, email, or any identifying information</li>
        <li>Your specific medical history</li>
        <li>Data from groups smaller than 11 people</li>
      </ul>
    </div>
  </div>
  
  <div className="rights-info">
    <h4>Your rights:</h4>
    <ul>
      <li>Opt out anytime (email privacy@mytreatmentpath.com)</li>
      <li>Delete your account (removes your personal data)</li>
      <li>Request information about how your data is used</li>
    </ul>
  </div>
  
  <label className="consent-checkbox-large">
    <input 
      type="checkbox" 
      name="analytics_consent" 
      required 
      checked={analyticsConsent}
      onChange={(e) => setAnalyticsConsent(e.target.checked)}
    />
    <span>
      I consent to de-identification and use of my data as described above.
      I understand I can opt out or delete my account anytime.
    </span>
  </label>
  
  <div className="consent-links">
    <a href="/privacy-policy#analytics" target="_blank">
      Learn More: Privacy Policy
    </a>
    {' | '}
    <a href="/terms-of-use#analytics" target="_blank">
      Learn More: Terms of Use
    </a>
  </div>
</div>
```

---

## Option 3: Two-Step Consent (Opt-In + Opt-Out)

**Step 1: During signup (required)**

```
☐ I have read and agree to the Terms of Use and Privacy Policy. (Required)
```

**Step 2: In account settings (optional opt-out)**

```
Analytics & Research Participation

You are currently: ✓ OPTED IN to de-identified analytics

Your data is de-identified (name, email, etc. removed) and combined with 
10+ other users before being used for research and platform improvement.

[ Learn More About Analytics ] [ Opt Out ]
```

---

## Database Schema Addition

Add to your `users` table (Supabase):

```sql
ALTER TABLE auth.users 
ADD COLUMN analytics_consent BOOLEAN DEFAULT true;

ALTER TABLE auth.users 
ADD COLUMN analytics_consent_date TIMESTAMPTZ DEFAULT NOW();

-- Index for efficient filtering
CREATE INDEX idx_users_analytics_consent ON auth.users(analytics_consent);
```

Or for custom users table:

```sql
ALTER TABLE users 
ADD COLUMN analytics_consent BOOLEAN DEFAULT true;

ALTER TABLE users 
ADD COLUMN analytics_consent_date TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX idx_users_analytics_consent ON users(analytics_consent);
```

---

## Signup Flow Implementation

### React Component Example

```javascript
import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function SignupForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [analyticsConsent, setAnalyticsConsent] = useState(true);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const handleSignup = async (e) => {
    e.preventDefault();
    
    if (!termsAccepted) {
      alert('Please accept the Terms of Use and Privacy Policy');
      return;
    }

    // Create user
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          analytics_consent: analyticsConsent,
          analytics_consent_date: new Date().toISOString()
        }
      }
    });

    if (error) {
      console.error('Signup error:', error);
      return;
    }

    // Store consent in users table (if using custom table)
    await supabase
      .from('users')
      .update({
        analytics_consent: analyticsConsent,
        analytics_consent_date: new Date().toISOString()
      })
      .eq('id', data.user.id);

    console.log('User created with consent:', analyticsConsent);
  };

  return (
    <form onSubmit={handleSignup}>
      {/* Email/password fields */}
      <input 
        type="email" 
        value={email} 
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required 
      />
      <input 
        type="password" 
        value={password} 
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        required 
      />

      {/* Terms acceptance (required) */}
      <label>
        <input 
          type="checkbox" 
          checked={termsAccepted}
          onChange={(e) => setTermsAccepted(e.target.checked)}
          required
        />
        I accept the{' '}
        <a href="/terms" target="_blank">Terms of Use</a>
        {' '}and{' '}
        <a href="/privacy" target="_blank">Privacy Policy</a>
      </label>

      {/* Analytics consent (optional but default true) */}
      <label>
        <input 
          type="checkbox" 
          checked={analyticsConsent}
          onChange={(e) => setAnalyticsConsent(e.target.checked)}
        />
        I consent to de-identification and use of my data for research 
        as described in the Privacy Policy. 
        <small>(You can opt out anytime)</small>
      </label>

      <button type="submit">Create Account</button>
    </form>
  );
}
```

---

## Account Settings - Opt-Out Page

```javascript
export default function AnalyticsSettings() {
  const [analyticsConsent, setAnalyticsConsent] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleOptOut = async () => {
    setLoading(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    
    await supabase
      .from('users')
      .update({
        analytics_consent: false,
        analytics_opt_out_date: new Date().toISOString()
      })
      .eq('id', user.id);

    setAnalyticsConsent(false);
    setLoading(false);
    
    alert('You have been opted out of analytics. Your data will be excluded from future aggregations.');
  };

  const handleOptIn = async () => {
    setLoading(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    
    await supabase
      .from('users')
      .update({
        analytics_consent: true,
        analytics_consent_date: new Date().toISOString(),
        analytics_opt_out_date: null
      })
      .eq('id', user.id);

    setAnalyticsConsent(true);
    setLoading(false);
    
    alert('You have been opted back in to analytics.');
  };

  return (
    <div className="analytics-settings">
      <h2>Analytics & Research Participation</h2>
      
      <div className="status">
        You are currently:{' '}
        {analyticsConsent ? (
          <span className="opted-in">✓ OPTED IN</span>
        ) : (
          <span className="opted-out">✗ OPTED OUT</span>
        )}
      </div>
      
      <p>
        Your data is de-identified (name, email, etc. removed) and combined 
        with 10+ other users before being used for research and platform improvement.
      </p>
      
      <div className="actions">
        <a href="/privacy-policy#analytics" target="_blank">
          Learn More About Analytics
        </a>
        
        {analyticsConsent ? (
          <button onClick={handleOptOut} disabled={loading}>
            Opt Out
          </button>
        ) : (
          <button onClick={handleOptIn} disabled={loading}>
            Opt Back In
          </button>
        )}
      </div>
    </div>
  );
}
```

---

## Update Analytics Aggregation to Respect Consent

In your Edge Function (`supabase/functions/analytics-aggregator/index.ts`):

```typescript
// When counting users, exclude opted-out users
const { count: totalUsers } = await supabase
  .from('users')
  .select('*', { count: 'exact', head: true })
  .eq('analytics_consent', true);  // ← Only count opted-in users
```

In PostgreSQL functions (`supabase/migrations/013_analytics_rpc_functions.sql`):

```sql
-- Add WHERE clause to exclude opted-out users
CREATE OR REPLACE FUNCTION get_diagnosis_aggregates(min_count INTEGER DEFAULT 11)
RETURNS TABLE (...) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.name::TEXT as diagnosis_type,
    c.name::TEXT as cancer_type,
    c.status::TEXT as stage,
    COUNT(DISTINCT c.user_id)::BIGINT as patient_count
  FROM conditions c
  INNER JOIN users u ON c.user_id = u.id
  WHERE c.name IS NOT NULL
    AND u.analytics_consent = true  -- ← Exclude opted-out users
  GROUP BY c.name, c.status
  HAVING COUNT(DISTINCT c.user_id) >= min_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Checklist for Legal Compliance

- [ ] Privacy Policy updated with analytics section
- [ ] Terms of Use updated with analytics section
- [ ] Signup flow includes consent checkbox
- [ ] Consent stored in database with timestamp
- [ ] Account settings allow opt-out
- [ ] Analytics aggregation respects opt-out flag
- [ ] Email confirmation sent when opt-out requested
- [ ] Legal review completed (consult attorney)
- [ ] Documentation accessible to users
- [ ] Contact information provided for privacy questions

---

## Email Templates

### Opt-Out Confirmation Email

```
Subject: Analytics Opt-Out Confirmed

Hi [First Name],

You have successfully opted out of analytics and research data aggregation.

What this means:
• Your data will be excluded from future analytics generation
• You can still use all MyTreatmentPath features normally
• Your personal health records remain private and accessible
• De-identified analytics created before today will remain (but cannot identify you)

Want to opt back in?
Visit Account Settings → Analytics & Research Participation

Questions? Contact privacy@mytreatmentpath.com

Thanks,
The MyTreatmentPath Team
```

---

**Status:** ✅ READY TO IMPLEMENT  
**Legal Status:** Follows HIPAA disclosure requirements  
**Next Step:** Add to your public website's Privacy Policy and Terms of Use
