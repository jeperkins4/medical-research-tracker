import React, { useState } from 'react';
import './MetastasisTutorial.css';

const MetastasisTutorial = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const slides = [
    {
      title: "Normal Bladder Cell",
      content: "In a healthy bladder cell, genes work together to control growth, repair DNA, and maintain order.",
      visual: "normal-cell",
      points: [
        "ARID1A acts as a 'chromatin organizer' - keeps DNA neatly packaged",
        "PIK3CA controls growth signals - only grows when needed",
        "Cell division is carefully regulated",
        "DNA repair systems work properly"
      ]
    },
    {
      title: "ARID1A Mutation: Loss of Order",
      content: "When ARID1A is mutated (like in your cancer), the cell loses its ability to organize DNA and repair damage.",
      visual: "arid1a-broken",
      points: [
        "DNA becomes disorganized and tangled",
        "HIF-1α pathway activates (hypoxia response)",
        "Cancer stem cells begin to form",
        "DNA repair mechanisms fail"
      ],
      highlight: "ARID1A"
    },
    {
      title: "PIK3CA Mutation: Constant Growth Signal",
      content: "PIK3CA mutation creates a 'stuck accelerator' - the cell gets a constant GROW signal even when it shouldn't.",
      visual: "pik3ca-active",
      points: [
        "PI3K/AKT/mTOR pathway stays ON permanently",
        "Cell divides uncontrollably",
        "Tumor cells resist apoptosis (programmed death)",
        "Works together with ARID1A loss to accelerate cancer"
      ],
      highlight: "PIK3CA"
    },
    {
      title: "FGFR3 Adds More Fuel",
      content: "FGFR3 mutation adds another growth signal on top of PIK3CA, making cells grow even faster.",
      visual: "fgfr3-fuel",
      points: [
        "Additional growth pathway activated",
        "Synergizes with PIK3CA mutation",
        "Cells divide at maximum speed",
        "Tumor grows aggressively"
      ],
      highlight: "FGFR3"
    },
    {
      title: "Tumor Formation & Hypoxia",
      content: "As the tumor grows, cells in the center run out of oxygen. This triggers HIF-1α, which creates cancer stem cells.",
      visual: "tumor-hypoxia",
      points: [
        "Tumor outgrows blood supply → low oxygen (hypoxia)",
        "HIF-1α activates (normally helps cells survive low oxygen)",
        "ARID1A loss makes HIF-1α go into OVERDRIVE",
        "Cancer stem cells form - these are immortal and treatment-resistant"
      ],
      danger: true
    },
    {
      title: "Breaking Through: Invasion",
      content: "Cancer cells secrete enzymes that dissolve the basement membrane - the barrier that normally contains them.",
      visual: "invasion",
      points: [
        "Matrix metalloproteinases (MMPs) break down tissue",
        "Cells squeeze through basement membrane",
        "Invade surrounding bladder tissue",
        "Enter blood vessels and lymphatic system"
      ]
    },
    {
      title: "Circulating Tumor Cells",
      content: "Cancer cells enter the bloodstream and circulate throughout your body, looking for places to settle.",
      visual: "circulation",
      points: [
        "Cells travel through blood vessels",
        "Most die from immune system or mechanical stress",
        "A few survivors find compatible organs",
        "Exit bloodstream at distant sites"
      ]
    },
    {
      title: "Bone Metastasis: Why Bones?",
      content: "Bladder cancer cells are attracted to bones because of growth factors and calcium-rich environment.",
      visual: "bone-mets",
      points: [
        "Bone marrow releases growth factors (TGF-β, IGF)",
        "Calcium signals attract cancer cells",
        "Cells exit bloodstream in bone marrow",
        "Form 'osteolytic' lesions (bone-destroying tumors)",
        "Common sites: spine, pelvis, ribs, femur"
      ],
      danger: true
    },
    {
      title: "Soft Tissue Metastasis",
      content: "Cancer cells can also colonize organs like liver, lungs, and lymph nodes.",
      visual: "soft-tissue-mets",
      points: [
        "Liver: Rich blood supply, filters blood from bladder",
        "Lungs: First capillary bed encountered",
        "Lymph nodes: Direct drainage from bladder",
        "Each organ provides growth factors for colonization"
      ]
    },
    {
      title: "How Treatments Target This Process",
      content: "Your treatment plan targets multiple steps in this metastatic cascade.",
      visual: "treatment-strategy",
      points: [
        "Padcev (enfortumab vedotin): Targets NECTIN4 on cancer cells → delivers toxic payload",
        "Curcumin: Blocks HIF-1α → kills cancer stem cells (targets ARID1A mutation)",
        "EGCG (green tea): Inhibits PI3K/mTOR → stops growth signal (targets PIK3CA mutation)",
        "Berberine: Reverses drug resistance (blocks P-glycoprotein pumps)"
      ],
      success: true
    }
  ];

  const goToSlide = (index) => {
    if (index >= 0 && index < slides.length) {
      setCurrentSlide(index);
    }
  };

  const nextSlide = () => goToSlide(currentSlide + 1);
  const prevSlide = () => goToSlide(currentSlide - 1);

  const slide = slides[currentSlide];

  return (
    <div className="metastasis-tutorial">
      <div className="tutorial-header">
        <h2>🎓 Understanding Bladder Cancer Metastasis</h2>
        <p className="subtitle">How your specific mutations (ARID1A, PIK3CA, FGFR3) drive cancer spread</p>
      </div>

      <div className="progress-bar">
        <div 
          className="progress-fill" 
          style={{ width: `${((currentSlide + 1) / slides.length) * 100}%` }}
        />
      </div>

      <div className={`tutorial-slide ${slide.danger ? 'danger' : ''} ${slide.success ? 'success' : ''}`}>
        <div className="slide-content">
          <div className="slide-header">
            <span className="slide-number">Step {currentSlide + 1} of {slides.length}</span>
            <h3>{slide.title}</h3>
            {slide.highlight && (
              <span className={`mutation-badge ${slide.highlight.toLowerCase()}`}>
                {slide.highlight}
              </span>
            )}
          </div>

          <p className="slide-description">{slide.content}</p>

          <div className="visual-container">
            <SlideVisual type={slide.visual} isActive={true} />
          </div>

          <div className="key-points">
            <h4>Key Points:</h4>
            <ul>
              {slide.points.map((point, idx) => (
                <li key={idx} className="point-item" style={{ animationDelay: `${idx * 0.1}s` }}>
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="tutorial-controls">
        <button 
          onClick={prevSlide} 
          disabled={currentSlide === 0}
          className="control-btn prev"
        >
          ← Previous
        </button>
        
        <div className="slide-dots">
          {slides.map((_, idx) => (
            <button
              key={idx}
              className={`dot ${idx === currentSlide ? 'active' : ''}`}
              onClick={() => goToSlide(idx)}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>

        <button 
          onClick={nextSlide} 
          disabled={currentSlide === slides.length - 1}
          className="control-btn next"
        >
          Next →
        </button>
      </div>

      {currentSlide === slides.length - 1 && (
        <div className="completion-message">
          <div className="completion-card">
            <h3>🎉 Tutorial Complete!</h3>
            <p>You now understand how your specific mutations drive metastasis and how treatments target each step.</p>
            <button onClick={() => goToSlide(0)} className="restart-btn">
              ↻ Restart Tutorial
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Visual component for each slide type
const SlideVisual = ({ type, isActive }) => {
  switch (type) {
    case 'normal-cell':
      return <NormalCell />;
    case 'arid1a-broken':
      return <ARID1ABroken />;
    case 'pik3ca-active':
      return <PIK3CAActive />;
    case 'fgfr3-fuel':
      return <FGFR3Fuel />;
    case 'tumor-hypoxia':
      return <TumorHypoxia />;
    case 'invasion':
      return <Invasion />;
    case 'circulation':
      return <Circulation />;
    case 'bone-mets':
      return <BoneMetastasis />;
    case 'soft-tissue-mets':
      return <SoftTissueMets />;
    case 'treatment-strategy':
      return <TreatmentStrategy />;
    default:
      return <div className="placeholder-visual">Visual Coming Soon</div>;
  }
};

// Individual visual components with animations
const NormalCell = () => (
  <div className="visual normal-cell-visual">
    <div className="cell healthy">
      <div className="nucleus">
        <div className="dna organized"></div>
        <div className="gene arid1a active">ARID1A ✓</div>
        <div className="gene pik3ca normal">PIK3CA</div>
      </div>
      <div className="cell-label">Healthy Bladder Cell</div>
    </div>
  </div>
);

const ARID1ABroken = () => (
  <div className="visual arid1a-visual">
    <div className="cell mutated">
      <div className="nucleus chaotic">
        <div className="dna disorganized"></div>
        <div className="gene arid1a broken">ARID1A ✗</div>
        <div className="pathway hif1a activated">HIF-1α ↑↑</div>
        <div className="stem-cells forming">Cancer Stem Cells</div>
      </div>
      <div className="cell-label">ARID1A Mutated</div>
    </div>
  </div>
);

const PIK3CAActive = () => (
  <div className="visual pik3ca-visual">
    <div className="cell mutated">
      <div className="nucleus">
        <div className="gene pik3ca mutated">PIK3CA</div>
        <div className="pathway pi3k active">PI3K →</div>
        <div className="pathway akt active">AKT →</div>
        <div className="pathway mtor active">mTOR →</div>
        <div className="signal grow">GROW!</div>
      </div>
      <div className="dividing-cells">
        <div className="cell-copy">Cell Copy 1</div>
        <div className="cell-copy">Cell Copy 2</div>
        <div className="cell-copy">Cell Copy 3</div>
      </div>
      <div className="cell-label">PIK3CA Mutation = Constant Growth</div>
    </div>
  </div>
);

const FGFR3Fuel = () => (
  <div className="visual fgfr3-visual">
    <div className="cell-cluster">
      <div className="cell mutated fast-grow">
        <div className="gene fgfr3 mutated">FGFR3</div>
        <div className="gene pik3ca mutated">PIK3CA</div>
        <div className="growth-arrows">
          <div className="arrow">→</div>
          <div className="arrow">→</div>
          <div className="arrow">→</div>
        </div>
      </div>
      <div className="cell-label">Double Mutation = Aggressive Growth</div>
    </div>
  </div>
);

const TumorHypoxia = () => (
  <div className="visual tumor-visual">
    <div className="tumor-mass">
      <div className="tumor-center hypoxic">
        <div className="cell stem">Stem Cell</div>
        <div className="cell stem">Stem Cell</div>
        <div className="oxygen-symbol low">O₂ ↓</div>
        <div className="hif-signal">HIF-1α ACTIVE</div>
      </div>
      <div className="tumor-outer">
        <div className="cell">Cell</div>
        <div className="cell">Cell</div>
        <div className="cell">Cell</div>
      </div>
      <div className="blood-vessel">
        <div className="vessel-line"></div>
        <div className="oxygen-symbol">O₂</div>
      </div>
    </div>
    <div className="cell-label">Tumor with Low-Oxygen Center</div>
  </div>
);

const Invasion = () => (
  <div className="visual invasion-visual">
    <div className="tissue-layers">
      <div className="normal-tissue">Normal Tissue</div>
      <div className="basement-membrane breaking">
        <span>Basement Membrane</span>
        <div className="enzyme">MMP</div>
        <div className="break-point">💥</div>
      </div>
      <div className="cancer-cells invading">
        <div className="cell cancer">Cancer Cell</div>
        <div className="cell cancer">Cancer Cell</div>
      </div>
      <div className="blood-vessel">
        <span>Blood Vessel →</span>
      </div>
    </div>
    <div className="cell-label">Breaking Through Tissue Barriers</div>
  </div>
);

const Circulation = () => (
  <div className="visual circulation-visual">
    <div className="bloodstream">
      <div className="vessel-path">
        <div className="blood-cell circulating">🔴</div>
        <div className="cancer-cell circulating">⚫</div>
        <div className="blood-cell circulating">🔴</div>
        <div className="cancer-cell circulating">⚫</div>
      </div>
      <div className="organ-destination">
        <div className="organ bone">Bone</div>
        <div className="organ liver">Liver</div>
        <div className="organ lung">Lung</div>
      </div>
    </div>
    <div className="cell-label">Cancer Cells Traveling Through Blood</div>
  </div>
);

const BoneMetastasis = () => (
  <div className="visual bone-mets-visual">
    <div className="bone-structure">
      <div className="bone-marrow">
        <span>Bone Marrow</span>
        <div className="growth-factor">TGF-β</div>
        <div className="growth-factor">IGF</div>
        <div className="calcium">Ca²⁺</div>
      </div>
      <div className="bone-cortex">
        <span>Bone</span>
        <div className="lesion">
          <div className="cancer-cell">⚫</div>
          <div className="cancer-cell">⚫</div>
          <div className="cancer-cell">⚫</div>
          <div className="bone-destruction">Osteolytic Lesion</div>
        </div>
      </div>
    </div>
    <div className="cell-label">Bone Metastasis Formation</div>
  </div>
);

const SoftTissueMets = () => (
  <div className="visual soft-tissue-visual">
    <div className="organs-grid">
      <div className="organ-card liver">
        <div className="organ-icon">🫀</div>
        <div className="organ-name">Liver</div>
        <div className="met-site">●</div>
      </div>
      <div className="organ-card lung">
        <div className="organ-icon">🫁</div>
        <div className="organ-name">Lungs</div>
        <div className="met-site">●</div>
      </div>
      <div className="organ-card lymph">
        <div className="organ-icon">⚪</div>
        <div className="organ-name">Lymph Nodes</div>
        <div className="met-site">●</div>
      </div>
    </div>
    <div className="cell-label">Common Metastasis Sites</div>
  </div>
);

const TreatmentStrategy = () => (
  <div className="visual treatment-visual">
    <div className="treatment-map">
      <div className="target-box">
        <div className="mutation">NECTIN4</div>
        <div className="drug padcev">Padcev →</div>
        <div className="effect">Kills Cancer Cells</div>
      </div>
      <div className="target-box">
        <div className="mutation">HIF-1α (from ARID1A loss)</div>
        <div className="drug curcumin">Curcumin →</div>
        <div className="effect">Kills Stem Cells</div>
      </div>
      <div className="target-box">
        <div className="mutation">PI3K/mTOR (from PIK3CA)</div>
        <div className="drug egcg">EGCG →</div>
        <div className="effect">Blocks Growth</div>
      </div>
      <div className="target-box">
        <div className="mutation">P-gp Drug Pumps</div>
        <div className="drug berberine">Berberine →</div>
        <div className="effect">Reverses Resistance</div>
      </div>
    </div>
    <div className="cell-label">Multi-Target Treatment Strategy</div>
  </div>
);

export default MetastasisTutorial;
