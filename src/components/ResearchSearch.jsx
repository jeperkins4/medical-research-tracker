import { useState, useEffect } from 'react';
// Packaged Electron app: no HTTP research server — IPC handlers not yet implemented.
// Guard all /api/tags and /api/papers calls so they degrade gracefully.
const isElectron = typeof window !== 'undefined' && !!window.electron;

export default function ResearchSearch() {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [tags, setTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState({});
  const [newTagName, setNewTagName] = useState('');
  const [savedPapers, setSavedPapers] = useState([]);
  const [activeTab, setActiveTab] = useState('search'); // search, saved

  useEffect(() => {
    loadTags();
    loadSavedPapers();
  }, []);

  const loadTags = async () => {
    if (isElectron) {
      // window.electron: research/tags IPC not yet implemented — skip gracefully
      return;
    }
    try {
      const response = await fetch('/api/tags', {
        credentials: 'include'
      });
      const data = await response.json();
      setTags(data);
    } catch (error) {
      console.error('Failed to load tags:', error);
    }
  };

  const loadSavedPapers = async () => {
    if (isElectron) {
      // window.electron: research/papers IPC not yet implemented — skip gracefully
      return;
    }
    try {
      const response = await fetch('/api/papers/detailed', {
        credentials: 'include'
      });
      const data = await response.json();
      setSavedPapers(data);
    } catch (error) {
      console.error('Failed to load saved papers:', error);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    if (isElectron) {
      // window.electron: research search IPC not yet implemented
      alert('Online research search is not available in the offline app. Use PubMed directly.');
      return;
    }

    setSearching(true);
    
    // Note: This uses a placeholder endpoint
    // In production, you'd integrate with PubMed API or similar
    try {
      const response = await fetch(`/api/search/research?q=${encodeURIComponent(query)}`, {
        credentials: 'include'
      });
      const data = await response.json();
      
      // For demo, show message about manual search
      alert('Research search endpoint ready. For now, manually search PubMed/ClinicalTrials.gov and use "Add Paper" to save results with tags.');
      setResults([]);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setSearching(false);
    }
  };

  const createTag = async () => {
    if (!newTagName.trim()) return;

    if (isElectron) {
      // window.electron: tags IPC not yet implemented
      alert('Tag management is not yet available in the offline app.');
      return;
    }

    try {
      const response = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: newTagName })
      });
      
      if (response.ok) {
        setNewTagName('');
        loadTags();
      }
    } catch (error) {
      console.error('Failed to create tag:', error);
    }
  };

  const savePaper = async (paper) => {
    const tagIds = Object.keys(selectedTags[paper.url] || {}).filter(id => selectedTags[paper.url][id]);
    
    if (isElectron) {
      // window.electron: papers IPC not yet implemented
      alert('Saving papers is not yet available in the offline app.');
      return;
    }

    try {
      const response = await fetch('/api/papers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...paper,
          tags: tagIds.map(id => parseInt(id))
        })
      });
      
      if (response.ok) {
        alert('Paper saved to library!');
        setSelectedTags(prev => {
          const updated = { ...prev };
          delete updated[paper.url];
          return updated;
        });
        loadSavedPapers();
      }
    } catch (error) {
      console.error('Failed to save paper:', error);
    }
  };

  const toggleTag = (paperUrl, tagId) => {
    setSelectedTags(prev => ({
      ...prev,
      [paperUrl]: {
        ...(prev[paperUrl] || {}),
        [tagId]: !prev[paperUrl]?.[tagId]
      }
    }));
  };

  const addTagToPaper = async (paperId, tagId) => {
    if (isElectron) {
      // window.electron: paper-tag IPC not yet implemented
      return;
    }
    try {
      await fetch(`/api/papers/${paperId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tag_id: tagId })
      });
      loadSavedPapers();
    } catch (error) {
      console.error('Failed to add tag:', error);
    }
  };

  const removeTagFromPaper = async (paperId, tagId) => {
    if (isElectron) {
      // window.electron: paper-tag IPC not yet implemented
      return;
    }
    try {
      await fetch(`/api/papers/${paperId}/tags/${tagId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      loadSavedPapers();
    } catch (error) {
      console.error('Failed to remove tag:', error);
    }
  };

  return (
    <div className="research-search">
      <div className="tabs">
        <button
          className={activeTab === 'search' ? 'active' : ''}
          onClick={() => setActiveTab('search')}
        >
          Search
        </button>
        <button
          className={activeTab === 'saved' ? 'active' : ''}
          onClick={() => setActiveTab('saved')}
        >
          Saved Papers ({savedPapers.length})
        </button>
        <button
          className={activeTab === 'tags' ? 'active' : ''}
          onClick={() => setActiveTab('tags')}
        >
          Manage Tags ({tags.length})
        </button>
      </div>

      {activeTab === 'search' && (
        <div className="search-tab">
          <form onSubmit={handleSearch} className="search-form">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search: your diagnosis, treatment options, clinical trials..."
              className="search-input"
            />
            <button type="submit" disabled={searching || !query.trim()}>
              {searching ? 'Searching...' : 'Search'}
            </button>
          </form>

          <div className="search-tips">
            <h3>💡 Manual Search & Save</h3>
            <p>While automated search is being implemented, you can:</p>
            <ol>
              <li>Search <a href="https://pubmed.ncbi.nlm.nih.gov/" target="_blank" rel="noopener noreferrer">PubMed</a> or <a href="https://clinicaltrials.gov/" target="_blank" rel="noopener noreferrer">ClinicalTrials.gov</a></li>
              <li>Use "Add Paper Manually" below to save interesting articles</li>
              <li>Tag them for organization (treatment, trial, mechanism, etc.)</li>
            </ol>
          </div>

          <ManualPaperEntry tags={tags} onSave={loadSavedPapers} />
        </div>
      )}

      {activeTab === 'saved' && (
        <div className="saved-tab">
          <h3>Saved Research Papers ({savedPapers.length})</h3>
          
          {savedPapers.length === 0 && (
            <p className="empty">No papers saved yet. Search and save articles to build your research library.</p>
          )}

          <div className="papers-list">
            {savedPapers.map(paper => (
              <div key={paper.id} className="paper-card">
                <h4>{paper.title}</h4>
                {paper.authors && <p className="authors">{paper.authors}</p>}
                {paper.journal && <p className="journal">{paper.journal} {paper.publication_date && `(${paper.publication_date})`}</p>}
                {paper.abstract && (
                  <p className="abstract">{paper.abstract.substring(0, 300)}...</p>
                )}
                
                <div className="paper-tags">
                  {paper.tags && paper.tags.map(tag => (
                    <span key={tag.id} className="tag">
                      {tag.name}
                      <button
                        className="tag-remove"
                        onClick={() => removeTagFromPaper(paper.id, tag.id)}
                        title="Remove tag"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        addTagToPaper(paper.id, parseInt(e.target.value));
                        e.target.value = '';
                      }
                    }}
                    className="add-tag-select"
                  >
                    <option value="">+ Add tag</option>
                    {tags.filter(t => !paper.tags?.find(pt => pt.id === t.id)).map(tag => (
                      <option key={tag.id} value={tag.id}>{tag.name}</option>
                    ))}
                  </select>
                </div>

                <div className="paper-links">
                  {paper.url && <a href={paper.url} target="_blank" rel="noopener noreferrer">View Article</a>}
                  {paper.pmid && <a href={`https://pubmed.ncbi.nlm.nih.gov/${paper.pmid}/`} target="_blank" rel="noopener noreferrer">PubMed</a>}
                  {paper.doi && <a href={`https://doi.org/${paper.doi}`} target="_blank" rel="noopener noreferrer">DOI</a>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'tags' && (
        <div className="tags-tab">
          <h3>Tag Management</h3>
          
          <div className="create-tag">
            <input
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="New tag name (e.g., immunotherapy, Phase 3, your diagnosis)"
              onKeyPress={(e) => e.key === 'Enter' && createTag()}
            />
            <button onClick={createTag}>Create Tag</button>
          </div>

          <div className="tags-list">
            <h4>Existing Tags ({tags.length})</h4>
            {tags.map(tag => {
              const paperCount = savedPapers.filter(p => p.tags?.find(t => t.id === tag.id)).length;
              return (
                <div key={tag.id} className="tag-item">
                  <span className="tag">{tag.name}</span>
                  <span className="tag-count">{paperCount} papers</span>
                </div>
              );
            })}
          </div>

          <div className="tag-suggestions">
            <h4>💡 Suggested Tags</h4>
            <p>Organize your research library with tags like:</p>
            <div className="tag-examples">
              <button onClick={() => { setNewTagName('immunotherapy'); }}>immunotherapy</button>
              <button onClick={() => { setNewTagName('clinical trial'); }}>clinical trial</button>
              <button onClick={() => { setNewTagName('Phase 1'); }}>Phase 1</button>
              <button onClick={() => { setNewTagName('Phase 2'); }}>Phase 2</button>
              <button onClick={() => { setNewTagName('Phase 3'); }}>Phase 3</button>
              <button onClick={() => { setNewTagName('targeted therapy'); }}>targeted therapy</button>
              <button onClick={() => { setNewTagName('chemotherapy'); }}>chemotherapy</button>
              <button onClick={() => { setNewTagName('radiation'); }}>radiation</button>
              <button onClick={() => { setNewTagName('checkpoint inhibitor'); }}>checkpoint inhibitor</button>
              <button onClick={() => { setNewTagName('CAR-T'); }}>CAR-T</button>
              <button onClick={() => { setNewTagName('integrative'); }}>integrative</button>
              <button onClick={() => { setNewTagName('nutrition'); }}>nutrition</button>
              <button onClick={() => { setNewTagName('side effects'); }}>side effects</button>
              <button onClick={() => { setNewTagName('repurposed drug'); }}>repurposed drug</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ManualPaperEntry({ tags, onSave }) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    authors: '',
    journal: '',
    publication_date: '',
    abstract: '',
    url: '',
    pmid: '',
    doi: '',
    type: 'research'
  });
  const [selectedTags, setSelectedTags] = useState({});

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const toggleTag = (tagId) => {
    setSelectedTags(prev => ({ ...prev, [tagId]: !prev[tagId] }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const tagIds = Object.keys(selectedTags).filter(id => selectedTags[id]).map(id => parseInt(id));
    
    if (isElectron) {
      // window.electron: paper-save IPC not yet implemented
      alert('Saving papers is not yet available in the offline app.');
      return;
    }

    try {
      const response = await fetch('/api/papers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          tags: tagIds
        })
      });
      
      if (response.ok) {
        alert('Paper saved!');
        setFormData({
          title: '',
          authors: '',
          journal: '',
          publication_date: '',
          abstract: '',
          url: '',
          pmid: '',
          doi: '',
          type: 'research'
        });
        setSelectedTags({});
        setShowForm(false);
        onSave();
      }
    } catch (error) {
      console.error('Failed to save paper:', error);
    }
  };

  if (!showForm) {
    return (
      <div className="manual-entry-button">
        <button onClick={() => setShowForm(true)}>+ Add Paper Manually</button>
      </div>
    );
  }

  return (
    <div className="manual-entry-form">
      <h3>Add Paper Manually</h3>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Title *</label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label>Authors</label>
          <input
            type="text"
            name="authors"
            value={formData.authors}
            onChange={handleChange}
            placeholder="Last FM, First FM, et al."
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Journal</label>
            <input
              type="text"
              name="journal"
              value={formData.journal}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>Publication Date</label>
            <input
              type="text"
              name="publication_date"
              value={formData.publication_date}
              onChange={handleChange}
              placeholder="2024"
            />
          </div>
        </div>

        <div className="form-group">
          <label>Abstract</label>
          <textarea
            name="abstract"
            value={formData.abstract}
            onChange={handleChange}
            rows="4"
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>URL</label>
            <input
              type="url"
              name="url"
              value={formData.url}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>PMID</label>
            <input
              type="text"
              name="pmid"
              value={formData.pmid}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>DOI</label>
            <input
              type="text"
              name="doi"
              value={formData.doi}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="form-group">
          <label>Type</label>
          <select name="type" value={formData.type} onChange={handleChange}>
            <option value="research">Research</option>
            <option value="clinical-trial">Clinical Trial</option>
            <option value="review">Review</option>
            <option value="meta-analysis">Meta-Analysis</option>
            <option value="case-report">Case Report</option>
          </select>
        </div>

        <div className="form-group">
          <label>Tags</label>
          <div className="tag-checkboxes">
            {tags.map(tag => (
              <label key={tag.id} className="tag-checkbox">
                <input
                  type="checkbox"
                  checked={selectedTags[tag.id] || false}
                  onChange={() => toggleTag(tag.id)}
                />
                {tag.name}
              </label>
            ))}
          </div>
        </div>

        <div className="form-actions">
          <button type="button" onClick={() => setShowForm(false)}>Cancel</button>
          <button type="submit">Save Paper</button>
        </div>
      </form>
    </div>
  );
}
