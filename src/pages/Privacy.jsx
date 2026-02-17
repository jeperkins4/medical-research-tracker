function Privacy({ onBack }) {
  return (
    <div className="legal-page">
      <div className="legal-container">
        <button className="back-button" onClick={onBack}>← Back to Login</button>
        
        <h1>Privacy Policy</h1>
        <p className="last-updated">Last Updated: February 15, 2026</p>

        <section>
          <h2>Our Commitment to Privacy</h2>
          <p>
            <strong>Your health data belongs to you. Period.</strong> MyTreatmentPath is designed 
            with privacy as the foundation, not an afterthought.
          </p>
        </section>

        <section>
          <h2>Data Storage</h2>
          <p>
            All your health data is stored <strong>locally on your device</strong>. We do not use 
            cloud storage, third-party servers, or external databases for your personal health information.
          </p>
          <ul>
            <li><strong>Database:</strong> SQLite database encrypted with AES-256</li>
            <li><strong>Location:</strong> Your device only</li>
            <li><strong>Backups:</strong> Encrypted, stored locally, managed by you</li>
            <li><strong>Access:</strong> Only you have access to your data</li>
          </ul>
        </section>

        <section>
          <h2>HIPAA Compliance</h2>
          <p>
            MyTreatmentPath implements HIPAA-grade security measures:
          </p>
          <ul>
            <li>AES-256-GCM encryption for all health data at rest</li>
            <li>Audit logging of all data access and modifications</li>
            <li>Automated encrypted backups with 30-day retention</li>
            <li>Session-based encryption key management</li>
            <li>No transmission of PHI to external services</li>
          </ul>
        </section>

        <section>
          <h2>What We Collect</h2>
          <h3>Health Information You Provide:</h3>
          <ul>
            <li>Personal health records (vitals, medications, conditions)</li>
            <li>Laboratory results and test data</li>
            <li>Provider information and medical history</li>
            <li>Research papers and notes you save</li>
            <li>Nutrition and dietary tracking data</li>
          </ul>
          
          <h3>Technical Data (Local Only):</h3>
          <ul>
            <li>Application usage logs (for debugging)</li>
            <li>Audit trail of data modifications</li>
            <li>Authentication session data</li>
          </ul>

          <h3>What We DON'T Collect:</h3>
          <ul>
            <li>❌ No analytics or tracking cookies</li>
            <li>❌ No third-party advertising data</li>
            <li>❌ No location tracking</li>
            <li>❌ No device fingerprinting</li>
            <li>❌ No cloud syncing of PHI</li>
          </ul>
        </section>

        <section>
          <h2>External Services</h2>
          <p>
            MyTreatmentPath uses limited external services that do NOT receive your health data:
          </p>
          <ul>
            <li>
              <strong>OpenAI Whisper API:</strong> Only if you use the audio transcription feature 
              for family stories (Fortress of Solitude module). Audio is sent to OpenAI for 
              transcription only. No health data is included.
            </li>
            <li>
              <strong>Research Search APIs:</strong> When you search for clinical trials or research, 
              only your search terms are sent to public databases (PubMed, ClinicalTrials.gov). 
              No personal health information is transmitted.
            </li>
            <li>
              <strong>Portal Automation:</strong> When you enable automated portal syncing, your 
              portal credentials are stored locally (encrypted) and used only to fetch your own 
              data from your healthcare providers.
            </li>
          </ul>
        </section>

        <section>
          <h2>AI Features</h2>
          <p>
            The AI-powered features (genomic analysis, research summaries, nutrition scoring) run 
            entirely on de-identified data. When AI processing is used:
          </p>
          <ul>
            <li>All personally identifiable information is stripped before processing</li>
            <li>AI providers receive only clinical data necessary for the analysis</li>
            <li>Results are returned and stored locally on your device</li>
            <li>You can opt out of AI features entirely</li>
          </ul>
        </section>

        <section>
          <h2>Data Sharing</h2>
          <p>
            <strong>We will never sell, rent, or share your health data with third parties.</strong>
          </p>
          <p>
            The only exception: if you explicitly choose to export your data (PDF, CSV) and share 
            it with your healthcare providers or researchers of your choosing.
          </p>
        </section>

        <section>
          <h2>Your Rights</h2>
          <p>You have complete control over your data:</p>
          <ul>
            <li><strong>Access:</strong> View all your data anytime through the application</li>
            <li><strong>Export:</strong> Download your complete health record in multiple formats</li>
            <li><strong>Delete:</strong> Permanently delete all your data at any time</li>
            <li><strong>Correct:</strong> Edit or update any information you've entered</li>
            <li><strong>Audit:</strong> Review the complete audit log of all data changes</li>
          </ul>
        </section>

        <section>
          <h2>Data Retention</h2>
          <p>
            Data is retained on your device indefinitely until you choose to delete it. 
            Automated backups are retained for 30 days and then overwritten.
          </p>
        </section>

        <section>
          <h2>Security Measures</h2>
          <ul>
            <li>Database-level encryption (SQLCipher AES-256)</li>
            <li>Password-based authentication with bcrypt hashing</li>
            <li>Session-based access control</li>
            <li>Automatic session timeout after inactivity</li>
            <li>Encrypted backup files with separate encryption keys</li>
            <li>Audit logging with tamper detection</li>
          </ul>
        </section>

        <section>
          <h2>Breach Notification</h2>
          <p>
            Because all data is stored locally on your device, traditional "data breach" scenarios 
            (server hacks, cloud leaks) do not apply. However, if a security vulnerability is 
            discovered in the application itself, we will:
          </p>
          <ul>
            <li>Issue an immediate security update</li>
            <li>Notify all users via the application</li>
            <li>Provide guidance on protective measures</li>
            <li>Publish a detailed disclosure after patching</li>
          </ul>
        </section>

        <section>
          <h2>Children's Privacy</h2>
          <p>
            MyTreatmentPath is not intended for use by individuals under the age of 18 without 
            parental consent and supervision.
          </p>
        </section>

        <section>
          <h2>Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of any changes 
            by posting the new Privacy Policy on this page and updating the "Last Updated" date.
          </p>
        </section>

        <section>
          <h2>Contact Us</h2>
          <p>
            Questions about this Privacy Policy? Contact us at:{' '}
            <a href="mailto:privacy@mytreatmentpath.com">privacy@mytreatmentpath.com</a>
          </p>
        </section>

        <section className="highlight">
          <h2>Bottom Line</h2>
          <p>
            <strong>Your health data never leaves your device unless you explicitly export it.</strong> 
            {' '}No cloud storage. No third-party sharing. No analytics. No tracking. 
            Your health journey, your data, your control.
          </p>
        </section>
      </div>
    </div>
  );
}

export default Privacy;
