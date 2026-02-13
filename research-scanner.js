#!/usr/bin/env node
/**
 * Medical Research Scanner
 * Searches for new articles on treatments, supplements, and clinical trials
 * Stores results in news_feed table
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'data', 'health.db');
const db = new Database(dbPath);

// Search terms organized by category
const SEARCH_TERMS = {
  // Current Conventional Treatments
  conventional: [
    'Keytruda pembrolizumab bladder cancer',
    'Padcev enfortumab vedotin urothelial cancer',
    'pembrolizumab enfortumab combination bladder',
  ],
  
  // Pipeline Drugs
  pipeline: [
    'BT8009 zelenectide pevedotin nectin-4',
    'ETx-22 nectin-4 bladder cancer',
    'nectin-4 ADC urothelial cancer trial',
  ],
  
  // Integrative Supplements
  integrative: [
    'low dose naltrexone LDN bladder cancer',
    'IV vitamin C urothelial cancer',
    'Angiostop sea cucumber cancer',
    'fenbendazole cancer clinical',
    'ivermectin cancer research',
    'methylene blue cancer mitochondrial',
  ],
  
  // Clinical Trials
  trials: [
    'bladder cancer clinical trial 2025',
    'urothelial carcinoma immunotherapy trial',
    'nectin-4 targeted therapy trial',
    'stage IV bladder cancer new treatment',
  ],
  
  // Mechanisms & Research
  research: [
    'nectin-4 expression bladder cancer',
    'checkpoint inhibitor bladder cancer',
    'OGF-OGFr axis cancer',
    'angiogenesis inhibition bladder cancer',
  ],
};

// Calculate relevance score based on keywords
function calculateRelevance(title, snippet, searchTerm) {
  const text = `${title} ${snippet}`.toLowerCase();
  let score = 0;
  
  // High priority keywords
  const highPriority = ['phase 3', 'phase iii', 'fda approval', 'breakthrough', 'complete response', 'survival benefit'];
  const mediumPriority = ['phase 2', 'phase ii', 'clinical trial', 'efficacy', 'safety'];
  const conditions = ['bladder cancer', 'urothelial cancer', 'urothelial carcinoma'];
  
  highPriority.forEach(kw => { if (text.includes(kw)) score += 3; });
  mediumPriority.forEach(kw => { if (text.includes(kw)) score += 2; });
  conditions.forEach(kw => { if (text.includes(kw)) score += 2; });
  
  // Recent dates boost score
  const year2025 = text.includes('2025') || text.includes('2026');
  const year2024 = text.includes('2024');
  if (year2025) score += 3;
  else if (year2024) score += 1;
  
  return score;
}

// Insert article into database
function insertArticle(article) {
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
    // URL already exists (UNIQUE constraint)
    return false;
  }
}

// Main search function - THIS IS A PLACEHOLDER
// OpenClaw will replace this with actual web_search tool calls
async function searchWeb(query) {
  console.log(`  Searching: ${query}`);
  
  // Placeholder - OpenClaw agent will implement actual searches
  // This script is meant to be called by an OpenClaw cron job
  // which has access to web_search tool
  
  return {
    query,
    results: []
  };
}

// Process all search terms
async function runScanner() {
  console.log('🔬 Medical Research Scanner Starting...\n');
  
  let totalNew = 0;
  let totalSearches = 0;
  
  for (const [category, terms] of Object.entries(SEARCH_TERMS)) {
    console.log(`\n📂 Category: ${category.toUpperCase()}`);
    
    for (const term of terms) {
      totalSearches++;
      const results = await searchWeb(term);
      
      // Process results
      results.results?.forEach(result => {
        const relevance = calculateRelevance(result.title, result.description, term);
        
        // Only save articles with relevance score > 0
        if (relevance > 0) {
          const article = {
            title: result.title,
            url: result.url,
            snippet: result.description,
            source: result.siteName || 'Unknown',
            published_date: result.published || null,
            search_term: term,
            relevance_score: relevance,
          };
          
          const inserted = insertArticle(article);
          if (inserted) {
            totalNew++;
            console.log(`    ✓ New: ${article.title.substring(0, 60)}... (score: ${relevance})`);
          }
        }
      });
    }
  }
  
  console.log(`\n\n✅ Scanner Complete`);
  console.log(`   Total searches: ${totalSearches}`);
  console.log(`   New articles: ${totalNew}`);
  
  // Get stats
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unread,
      MAX(discovered_at) as last_update
    FROM news_feed
  `).get();
  
  console.log(`   Database total: ${stats.total}`);
  console.log(`   Unread: ${stats.unread}`);
  console.log(`   Last update: ${stats.last_update || 'Never'}`);
  
  db.close();
}

// Export search terms for use by OpenClaw cron job
export { SEARCH_TERMS, calculateRelevance, insertArticle };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runScanner().catch(console.error);
}
