function About({ onBack }) {
  return (
    <div className="legal-page">
      <div className="legal-container">
        <button className="back-button" onClick={onBack}>← Back to Login</button>
        
        <h1>About MyTreatmentPath</h1>

        <section>
          <h2>Our Story</h2>
          <p>
            MyTreatmentPath was created by cancer patients who got tired of drowning in spreadsheets, 
            PDFs, and scattered medical records.
          </p>
          <p>
            When you're fighting cancer, you're handed massive amounts of data — genomic reports, 
            lab results, clinical trial criteria, research papers, medication protocols — and told 
            to "stay informed" and "be your own advocate." But nobody gives you the tools to actually 
            do that effectively.
          </p>
          <p>
            This application is the tool we needed. And if it helps even one other patient navigate 
            their treatment journey with more clarity and control, it's worth sharing.
          </p>
        </section>

        <section>
          <h2>What We Believe</h2>
          <ul className="beliefs">
            <li>
              <strong>Your data belongs to you.</strong> Not in the cloud, not on our servers, 
              not for sale to anyone.
            </li>
            <li>
              <strong>Traditional + integrative aren't enemies.</strong> Good oncology uses both. 
              This tool supports whatever path you and your team choose.
            </li>
            <li>
              <strong>Research-driven patients deserve better tools.</strong> If you want to 
              understand the science behind your treatment, you shouldn't need a PhD to organize it.
            </li>
            <li>
              <strong>Privacy isn't a luxury.</strong> HIPAA-grade security should be the baseline, 
              not a premium feature.
            </li>
            <li>
              <strong>Patients are capable.</strong> Given the right tools and information, patients 
              can be active, informed participants in their own care.
            </li>
          </ul>
        </section>

        <section>
          <h2>What This Is</h2>
          <p>MyTreatmentPath is a comprehensive health records and research management platform designed for cancer patients who want to:</p>
          <ul>
            <li>Organize all their medical data in one secure place</li>
            <li>Connect genomic testing results to treatment options and clinical trials</li>
            <li>Track medications, vitals, and treatment responses over time</li>
            <li>Discover relevant research automatically through intelligent scanning</li>
            <li>Build evidence-based integrative protocols that complement traditional treatment</li>
            <li>Generate AI-powered summaries of their complete healthcare strategy</li>
          </ul>
        </section>

        <section>
          <h2>What This Isn't</h2>
          <ul>
            <li><strong>Not a replacement for medical advice.</strong> This is a tool for organizing information, not making diagnoses or treatment decisions.</li>
            <li><strong>Not a cure.</strong> This is data management and research discovery, not treatment.</li>
            <li><strong>Not anti-doctor.</strong> This is designed to help you work <em>with</em> your oncology team more effectively.</li>
            <li><strong>Not a social network.</strong> Your data stays private, local, and under your control.</li>
          </ul>
        </section>

        <section>
          <h2>Technology</h2>
          <p>Built with:</p>
          <ul>
            <li>React + Vite (modern, fast web framework)</li>
            <li>Express + Node.js (secure backend server)</li>
            <li>SQLite + SQLCipher (encrypted local database)</li>
            <li>OpenAI API (AI-powered research summaries and genomic analysis)</li>
            <li>Playwright (automated portal syncing for supported providers)</li>
          </ul>
          <p>
            Everything runs locally on your device. No cloud storage, no external databases, 
            no third-party data sharing.
          </p>
        </section>

        <section>
          <h2>Features</h2>
          <div className="features-grid">
            <div className="feature-item">
              <h3>🧬 Precision Medicine Dashboard</h3>
              <p>Connect your genomic mutations to targeted pathways, treatments, and clinical trials</p>
            </div>
            <div className="feature-item">
              <h3>📊 Complete Health Records</h3>
              <p>Track vitals, labs, medications, conditions, and provider visits in one place</p>
            </div>
            <div className="feature-item">
              <h3>🔬 Automated Research Scanner</h3>
              <p>Nightly scans for new clinical trials, treatment studies, and relevant research</p>
            </div>
            <div className="feature-item">
              <h3>🥗 Nutrition Tracking</h3>
              <p>Log meals with genomic pathway targeting and AI-powered analysis</p>
            </div>
            <div className="feature-item">
              <h3>🔐 Portal Integration</h3>
              <p>Automated syncing with Epic MyChart, Cerner, Flatiron CareSpace, and more</p>
            </div>
            <div className="feature-item">
              <h3>🧠 AI Strategy Summaries</h3>
              <p>GPT-4 powered synthesis of your complete treatment approach</p>
            </div>
            <div className="feature-item">
              <h3>📚 Evidence Library</h3>
              <p>Research-backed documentation for every medication and supplement</p>
            </div>
            <div className="feature-item">
              <h3>🔒 HIPAA-Grade Security</h3>
              <p>AES-256 encryption, audit logging, automated backups</p>
            </div>
          </div>
        </section>

        <section>
          <h2>Open Source</h2>
          <p>
            MyTreatmentPath is open source software. The code is available for review, audit, 
            and contribution. We believe healthcare tools should be transparent and trustworthy.
          </p>
          <p>
            <a href="https://github.com/mytreatmentpath" target="_blank" rel="noopener noreferrer">
              View on GitHub →
            </a>
          </p>
        </section>

        <section>
          <h2>Support</h2>
          <p>
            This is a passion project, not a billion-dollar health tech startup. Support is 
            volunteer-based and best-effort.
          </p>
          <ul>
            <li><strong>Documentation:</strong> <a href="https://docs.mytreatmentpath.com" target="_blank" rel="noopener noreferrer">docs.mytreatmentpath.com</a></li>
            <li><strong>Bug Reports:</strong> <a href="https://github.com/mytreatmentpath/issues" target="_blank" rel="noopener noreferrer">GitHub Issues</a></li>
            <li><strong>Email:</strong> <a href="mailto:support@mytreatmentpath.com">support@mytreatmentpath.com</a></li>
          </ul>
        </section>

        <section>
          <h2>Acknowledgments</h2>
          <p>Built with guidance and inspiration from:</p>
          <ul>
            <li>Oncologists and integrative medicine practitioners who understand precision medicine</li>
            <li>The cancer patient community across forums, support groups, and social networks</li>
            <li>Every patient who's ever asked "why isn't there a tool for this?"</li>
          </ul>
        </section>

        <section className="highlight">
          <h2>For Patients, By Patients</h2>
          <p>
            This isn't a venture-backed health tech play. This is patients' attempt to 
            bring order to chaos, to turn overwhelming data into actionable insight, and to 
            give other patients the tools they deserve.
          </p>
          <p>
            If you're reading this, you're probably in the fight too. You're not alone. 
            And you deserve better tools than spreadsheets and sticky notes.
          </p>
        </section>
      </div>
    </div>
  );
}

export default About;
