#!/usr/bin/env node
/**
 * Enhanced Medical Research Scanner
 * 
 * Searches for new articles on treatments, supplements, and clinical trials
 * Automatically populates Research Library with tagged papers
 * Stores results in both news_feed (for notifications) and papers (for Library)
 */

import Database from 'better-sqlite3-multiple-ciphers';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'data', 'health-secure.db');
const db = new Database(dbPath);

// Set encryption key
const DB_KEY = process.env.DB_ENCRYPTION_KEY;
if (!DB_KEY) {
  console.error('❌ DB_ENCRYPTION_KEY required');
  process.exit(1);
}

db.pragma(`key = "${DB_KEY}"`);
db.pragma('cipher_compatibility = 4');

// Search terms organized by category (maps to Library tags)
const SEARCH_TERMS = {
  // Current Conventional Treatments
  conventional: [
    'Keytruda pembrolizumab bladder cancer 2025 2026',
    'Padcev enfortumab vedotin urothelial cancer',
    'pembrolizumab enfortumab combination bladder',
    'gemcitabine cisplatin bladder cancer',
  ],
  
  // Pipeline Drugs (Experimental)
  pipeline: [
    'BT8009 zelenectide pevedotin nectin-4',
    'ETx-22 nectin-4 bladder cancer',
    'nectin-4 ADC urothelial cancer trial',
    'FGFR inhibitor urothelial cancer',
  ],
  
  // Integrative/Alternative Treatments
  integrative: [
    'low dose naltrexone LDN bladder cancer',
    'IV vitamin C urothelial cancer cisplatin',
    'Angiostop sea cucumber cancer',
    'fenbendazole cancer clinical study',
    'ivermectin cancer research bladder',
    'methylene blue cancer mitochondrial',
    'curcumin bladder cancer',
    'sulforaphane cancer stem cells',
  ],
  
  // Clinical Trials
  trials: [
    'bladder cancer clinical trial 2026 recruiting',
    'urothelial carcinoma immunotherapy trial phase 2',
    'nectin-4 targeted therapy trial enrollment',
    'stage IV bladder cancer new treatment trial',
  ],
  
  // Genomics & Biomarkers
  genomics: [
    'ARID1A mutation bladder cancer treatment',
    'FGFR3 mutation urothelial cancer therapy',
    'PIK3CA inhibitor bladder cancer',
    'nectin-4 expression biomarker',
    'tumor mutational burden bladder cancer',
  ],
  
  // Mechanisms & Pathways
  research: [
    'OGF-OGFr axis cancer naltrexone',
    'angiogenesis inhibition bladder cancer',
    'hypoxia HIF-1 pathway cancer',
    'PD-L1 immune checkpoint bladder',
    'autophagy cancer treatment',
  ],
  
  // GU Oncology Now (Specialist Resource)
  guoncology: [
    'site:guoncologynow.com bladder cancer',
    'site:guoncologynow.com urothelial cancer',
    'site:guoncologynow.com nectin-4',
    'site:guoncologynow.com immunotherapy bladder',
    'site:guoncologynow.com clinical trial bladder',
    'site:guoncologynow.com FGFR inhibitor',
  ],
};

// Tag mapping (category → Library tag IDs)
const TAG_MAP = {
  conventional: ['chemotherapy', 'immunotherapy', 'targeted-therapy'],
  pipeline: ['clinical-trial', 'experimental', 'ADC'],
  integrative: ['integrative', 'LDN', 'vitamin-c', 'supplements'],
  trials: ['clinical-trial', 'recruiting'],
  genomics: ['genomics', 'biomarkers', 'ARID1A', 'FGFR3'],
  research: ['mechanisms', 'pathways', 'basic-science'],
  guoncology: ['GU-oncology', 'expert-source', 'urology'],
};

/**
 * Calculate relevance score based on keywords
 */
function calculateRelevance(title, snippet, searchTerm) {
  const text = `${title} ${snippet}`.toLowerCase();
  let score = 0;
  
  // High priority keywords
  const highPriority = ['phase 3', 'phase iii', 'fda approval', 'breakthrough', 'complete response', 'survival benefit'];
  const mediumPriority = ['phase 2', 'phase ii', 'clinical trial', 'efficacy', 'safety', 'objective response'];
  const conditions = ['bladder cancer', 'urothelial cancer', 'urothelial carcinoma'];
  
  highPriority.forEach(kw => { if (text.includes(kw)) score += 3; });
  mediumPriority.forEach(kw => { if (text.includes(kw)) score += 2; });
  conditions.forEach(kw => { if (text.includes(kw)) score += 2; });
  
  // Recent dates boost score
  const year2026 = text.includes('2026');
  const year2025 = text.includes('2025');
  const year2024 = text.includes('2024');
  if (year2026) score += 4;
  else if (year2025) score += 3;
  else if (year2024) score += 1;
  
  // Genomic keywords (high value for personalized medicine)
  const genomicKeywords = ['arid1a', 'fgfr3', 'pik3ca', 'nectin-4', 'biomarker'];
  genomicKeywords.forEach(kw => { if (text.includes(kw)) score += 2; });
  
  return score;
}

/**
 * Insert article into news_feed (for notifications)
 */
function insertNewsArticle(article) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO news_feed (title, url, snippet, source, published_date, search_term, relevance_score)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  try {
    const result = stmt.run(
      article.title,
      article.url,
      article.snippet,
      article.source,
      article.published_date,
      article.search_term,
      article.relevance_score
    );
    return result.changes > 0;
  } catch (err) {
    return false; // URL already exists
  }
}

/**
 * Insert or get tag ID
 */
function getOrCreateTag(tagName) {
  // Check if tag exists
  let tag = db.prepare('SELECT id FROM tags WHERE name = ?').get(tagName);
  
  if (!tag) {
    // Create tag
    const result = db.prepare('INSERT INTO tags (name) VALUES (?)').run(tagName);
    return result.lastInsertRowid;
  }
  
  return tag.id;
}

/**
 * Insert article into papers table (for Library)
 */
function insertPaper(article, category) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO papers (title, url, authors, abstract, type, saved_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);
  
  try {
    const result = stmt.run(
      article.title,
      article.url,
      article.source, // Use source as authors placeholder
      article.snippet,
      category // conventional, integrative, etc.
    );
    
    if (result.changes > 0) {
      const paperId = result.lastInsertRowid;
      
      // Add tags
      const tags = TAG_MAP[category] || [];
      tags.forEach(tagName => {
        const tagId = getOrCreateTag(tagName);
        db.prepare('INSERT OR IGNORE INTO paper_tags (paper_id, tag_id) VALUES (?, ?)').run(paperId, tagId);
      });
      
      return true;
    }
    
    return false;
  } catch (err) {
    console.error(`Error inserting paper: ${err.message}`);
    return false;
  }
}

/**
 * Main search function
 * NOTE: This is meant to be called by OpenClaw agent with web_search tool access
 */
async function searchWeb(query) {
  console.log(`  Searching: ${query}`);
  
  // This is a placeholder - the actual implementation uses OpenClaw's web_search tool
  // When run via cron job, the agent has access to web_search
  
  return {
    query,
    results: []
  };
}

/**
 * Process all search terms
 */
async function runScanner() {
  console.log('🔬 Enhanced Medical Research Scanner Starting...\n');
  console.log('📚 Auto-populating Research Library with tagged papers\n');
  
  let totalNew = 0;
  let totalPapers = 0;
  let totalSearches = 0;
  
  for (const [category, terms] of Object.entries(SEARCH_TERMS)) {
    console.log(`\n📂 Category: ${category.toUpperCase()}`);
    
    for (const term of terms) {
      totalSearches++;
      const results = await searchWeb(term);
      
      // Process results
      results.results?.forEach(result => {
        const relevance = calculateRelevance(result.title, result.description, term);
        
        // Only save articles with relevance score > 2 (higher bar for Library)
        if (relevance >= 2) {
          const article = {
            title: result.title,
            url: result.url,
            snippet: result.description,
            source: result.siteName || 'Unknown',
            published_date: result.published || null,
            search_term: term,
            relevance_score: relevance,
          };
          
          // Save to news_feed (notifications)
          const insertedNews = insertNewsArticle(article);
          if (insertedNews) {
            totalNew++;
          }
          
          // Save to papers (Library) if relevance >= 3
          if (relevance >= 3) {
            const insertedPaper = insertPaper(article, category);
            if (insertedPaper) {
              totalPapers++;
              console.log(`    ✓ Library: ${article.title.substring(0, 60)}... (score: ${relevance})`);
            }
          }
        }
      });
    }
  }
  
  console.log(`\n\n✅ Scanner Complete`);
  console.log(`   Total searches: ${totalSearches}`);
  console.log(`   New in feed: ${totalNew}`);
  console.log(`   Added to Library: ${totalPapers}`);
  
  // Get stats
  const newsStats = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unread
    FROM news_feed
  `).get();
  
  const libraryStats = db.prepare('SELECT COUNT(*) as total FROM papers').get();
  
  console.log(`\n📊 Database Stats:`);
  console.log(`   News feed: ${newsStats.total} (${newsStats.unread} unread)`);
  console.log(`   Library: ${libraryStats.total} papers`);
  
  db.close();
}

// Export for use by OpenClaw cron job
export { SEARCH_TERMS, calculateRelevance, insertNewsArticle, insertPaper, getOrCreateTag };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runScanner().catch(console.error);
}
