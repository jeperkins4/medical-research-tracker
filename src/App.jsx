import { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [health, setHealth] = useState(null);
  const [activeTab, setActiveTab] = useState('profile');

  useEffect(() => {
    fetch('/api/health')
      .then(res => res.json())
      .then(data => setHealth(data))
      .catch(err => console.error('API connection failed:', err));
  }, []);

  return (
    <div className="app">
      <header>
        <h1>🏥 Medical Research Tracker</h1>
        <p>Personal health records + research discovery</p>
        {health && <span className="status">● Connected</span>}
      </header>

      <nav>
        <button 
          className={activeTab === 'profile' ? 'active' : ''}
          onClick={() => setActiveTab('profile')}
        >
          Health Profile
        </button>
        <button 
          className={activeTab === 'research' ? 'active' : ''}
          onClick={() => setActiveTab('research')}
        >
          Research
        </button>
        <button 
          className={activeTab === 'library' ? 'active' : ''}
          onClick={() => setActiveTab('library')}
        >
          Library
        </button>
      </nav>

      <main>
        {activeTab === 'profile' && <ProfileView />}
        {activeTab === 'research' && <ResearchView />}
        {activeTab === 'library' && <LibraryView />}
      </main>
    </div>
  );
}

function ProfileView() {
  const [conditions, setConditions] = useState([]);
  const [medications, setMedications] = useState([]);

  useEffect(() => {
    fetch('/api/conditions').then(r => r.json()).then(setConditions);
    fetch('/api/medications').then(r => r.json()).then(setMedications);
  }, []);

  return (
    <div className="view">
      <h2>Health Profile</h2>
      
      <section>
        <h3>Conditions ({conditions.length})</h3>
        {conditions.length === 0 && <p className="empty">No conditions tracked yet</p>}
        <ul>
          {conditions.map(c => (
            <li key={c.id}>
              <strong>{c.name}</strong>
              {c.diagnosed_date && <span> — Diagnosed {c.diagnosed_date}</span>}
              <span className={`status ${c.status}`}>{c.status}</span>
            </li>
          ))}
        </ul>
        <button>+ Add Condition</button>
      </section>

      <section>
        <h3>Medications ({medications.length})</h3>
        {medications.length === 0 && <p className="empty">No medications tracked yet</p>}
        <ul>
          {medications.map(m => (
            <li key={m.id}>
              <strong>{m.name}</strong> — {m.dosage} {m.frequency}
            </li>
          ))}
        </ul>
        <button>+ Add Medication</button>
      </section>
    </div>
  );
}

function ResearchView() {
  return (
    <div className="view">
      <h2>Research Discovery</h2>
      <p>Search PubMed and ClinicalTrials.gov for relevant studies</p>
      <input type="search" placeholder="Search medical research..." />
      <p className="coming-soon">🚧 Search functionality coming soon</p>
    </div>
  );
}

function LibraryView() {
  const [papers, setPapers] = useState([]);

  useEffect(() => {
    fetch('/api/papers').then(r => r.json()).then(setPapers);
  }, []);

  return (
    <div className="view">
      <h2>Research Library</h2>
      {papers.length === 0 && <p className="empty">No papers saved yet</p>}
      <div className="papers">
        {papers.map(p => (
          <div key={p.id} className="paper-card">
            <h4>{p.title}</h4>
            <p className="meta">{p.authors} • {p.journal}</p>
            <span className={`type ${p.type}`}>{p.type}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
