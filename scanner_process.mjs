import Database from 'better-sqlite3';

const dbPath = './data/health.db';
const db = new Database(dbPath);

function calculateRelevance(title, snippet) {
  const text = `${title} ${snippet}`.toLowerCase();
  let score = 0;
  
  const highPriority = ['phase 3', 'phase iii', 'fda approval', 'breakthrough', 'complete response', 'survival benefit'];
  const mediumPriority = ['phase 2', 'phase ii', 'clinical trial', 'efficacy', 'safety'];
  const conditions = ['bladder cancer', 'urothelial cancer', 'urothelial carcinoma'];
  
  highPriority.forEach(kw => { if (text.includes(kw)) score += 3; });
  mediumPriority.forEach(kw => { if (text.includes(kw)) score += 2; });
  conditions.forEach(kw => { if (text.includes(kw)) score += 2; });
  
  const year2025 = text.includes('2025') || text.includes('2026');
  const year2024 = text.includes('2024');
  if (year2025) score += 3;
  else if (year2024) score += 1;
  
  return score;
}

function cleanText(text) {
  return text.replace(/\n<<<EXTERNAL_UNTRUSTED_CONTENT>>>\nSource: Web Search\n---\n/g, '')
    .replace(/\n<<<END_EXTERNAL_UNTRUSTED_CONTENT>>>/g, '')
    .replace(/<strong>/g, '')
    .replace(/<\/strong>/g, '')
    .trim();
}

function insertArticle(article) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO news_feed (title, url, snippet, source, published_date, search_term, relevance_score)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  try {
    const result = stmt.run(
      article.title.substring(0, 500),
      article.url,
      article.snippet.substring(0, 1000),
      article.source,
      article.published_date,
      article.search_term,
      article.relevance_score
    );
    return result.changes > 0;
  } catch (err) {
    return false;
  }
}

// Parse search data from stdin
const searchData = JSON.parse(process.argv[2] || '[]');

let totalNew = 0;
const categories = {
  conventional: 0,
  pipeline: 0,
  integrative: 0,
  trials: 0,
  research: 0
};

searchData.forEach(search => {
  if (!search.results) return;
  
  search.results.forEach(result => {
    const title = cleanText(result.title);
    const snippet = cleanText(result.description);
    const relevance = calculateRelevance(title, snippet);
    
    if (relevance > 0) {
      const article = {
        title,
        url: result.url,
        snippet,
        source: result.siteName || 'Unknown',
        published_date: result.published || null,
        search_term: search.term,
        relevance_score: relevance
      };
      
      if (insertArticle(article)) {
        totalNew++;
        categories[search.category]++;
      }
    }
  });
});

const stats = db.prepare(`
  SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unread
  FROM news_feed
`).get();

console.log(JSON.stringify({
  totalNew,
  categories,
  dbTotal: stats.total,
  dbUnread: stats.unread
}));

db.close();
