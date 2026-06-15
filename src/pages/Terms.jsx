function Terms({ onBack }) {
  return (
    <div className="legal-page">
      <div className="legal-container">
        <button className="back-button" onClick={onBack}>← Back to Login</button>
        
        <h1>Terms of Use</h1>
        <p className="last-updated">Last Updated: February 15, 2026</p>

        <section>
          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing and using MyTreatmentPath, you accept and agree to be bound by the terms 
            and provision of this agreement.
          </p>
        </section>

        <section>
          <h2>2. Use License</h2>
          <p>
            Permission is granted to temporarily download one copy of MyTreatmentPath for personal, 
            non-commercial transitory viewing only. This is the grant of a license, not a transfer 
            of title.
          </p>
          <p>Under this license you may not:</p>
          <ul>
            <li>Modify or copy the materials</li>
            <li>Use the materials for any commercial purpose</li>
            <li>Attempt to decompile or reverse engineer any software</li>
            <li>Remove any copyright or other proprietary notations</li>
            <li>Transfer the materials to another person</li>
          </ul>
        </section>

        <section>
          <h2>3. Medical Disclaimer</h2>
          <p>
            <strong>MyTreatmentPath is a health records management tool and is not a substitute for 
            professional medical advice, diagnosis, or treatment.</strong>
          </p>
          <p>
            Always seek the advice of your physician or other qualified health provider with any 
            questions you may have regarding a medical condition. Never disregard professional 
            medical advice or delay in seeking it because of information accessed through this application.
          </p>
        </section>

        <section>
          <h2>4. Data Responsibility</h2>
          <p>
            You are responsible for:
          </p>
          <ul>
            <li>The accuracy and completeness of data you enter</li>
            <li>Maintaining the security of your account credentials</li>
            <li>Creating and maintaining backups of your data</li>
            <li>Appropriate use of the research discovery features</li>
          </ul>
        </section>

        <section>
          <h2>5. Limitation of Liability</h2>
          <p>
            In no event shall MyTreatmentPath or its developers be liable for any damages 
            (including, without limitation, damages for loss of data or profit, or due to business 
            interruption) arising out of the use or inability to use this application.
          </p>
        </section>

        <section>
          <h2>6. Research Features</h2>
          <p>
            The automated research scanner and AI-generated summaries are provided for informational 
            purposes only. All medical research should be reviewed and interpreted by qualified 
            healthcare professionals.
          </p>
        </section>

        <section>
          <h2>7. Modifications</h2>
          <p>
            We may revise these terms of use at any time without notice. By using this application, 
            you are agreeing to be bound by the then current version of these terms of use.
          </p>
        </section>

        <section>
          <h2>8. Contact</h2>
          <p>
            Questions about the Terms of Use should be sent to: <a href="mailto:support@mytreatmentpath.com">support@mytreatmentpath.com</a>
          </p>
        </section>
      </div>
    </div>
  );
}

export default Terms;
