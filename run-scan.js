#!/usr/bin/env node
/**
 * Medical Research Scanner Runner
 * Called by OpenClaw cron - performs web searches with rate limiting
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'data', 'health.db');
const db = new Database(dbPath);

// Search terms from research-scanner.js
const SEARCH_TERMS = {
  conventional: [
    'Keytruda pembrolizumab bladder cancer',
    'Padcev enfortumab vedotin urothelial cancer',
    'pembrolizumab enfortumab combination bladder',
  ],
  pipeline: [
    'BT8009 zelenectide pevedotin nectin-4',
    'ETx-22 nectin-4 bladder cancer',
    'nectin-4 ADC urothelial cancer trial',
  ],
  integrative: [
    'low dose naltrexone LDN bladder cancer',
    'IV vitamin C urothelial cancer',
    'Angiostop sea cucumber cancer',
    'fenbendazole cancer clinical',
    'ivermectin cancer research',
    'methylene blue cancer mitochondrial',
  ],
  trials: [
    'bladder cancer clinical trial 2025',
    'urothelial carcinoma immunotherapy trial',
    'nectin-4 targeted therapy trial',
    'stage IV bladder cancer new treatment',
  ],
  research: [
    'nectin-4 expression bladder cancer',
    'checkpoint inhibitor bladder cancer',
    'OGF-OGFr axis cancer',
    'angiogenesis inhibition bladder cancer',
  ],
};

// Calculate relevance score
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

// Insert article
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
    return false;
  }
}

// Read search results from stdin (JSON lines)
async function processResults() {
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });

  let totalNew = 0;
  let totalSearches = 0;
  const categoryStats = {};

  for await (const line of rl) {
    if (!line.trim()) continue;
    
    try {
      const searchResult = JSON.parse(line);
      totalSearches++;
      
      const category = searchResult.category;
      if (!categoryStats[category]) {
        categoryStats[category] = { searches: 0, newArticles: 0 };
      }
      categoryStats[category].searches++;
      
      if (searchResult.results && searchResult.results.length > 0) {
        for (const result of searchResult.results) {
          const relevance = calculateRelevance(result.title || '', result.snippet || '');
          
          if (relevance > 0) {
            const article = {
              title: result.title || 'Untitled',
              url: result.url,
              snippet: result.snippet || '',
              source: result.source || 'Unknown',
              published_date: result.age || null,
              search_term: searchResult.query,
              relevance_score: relevance,
            };
            
            const inserted = insertArticle(article);
            if (inserted) {
              totalNew++;
              categoryStats[category].newArticles++;
            }
          }
        }
      }
    } catch (err) {
      console.error('Error processing line:', err.message);
    }
  }

  // Get database stats
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unread
    FROM news_feed
  `).get();

  db.close();

  // Output summary
  console.log('\n✅ Medical Research Scanner Complete');
  console.log(`   Total searches: ${totalSearches}`);
  console.log(`   New articles found: ${totalNew}`);
  console.log(`   Database total: ${stats.total}`);
  console.log(`   Unread: ${stats.unread}`);
  console.log('\n📂 By Category:');
  for (const [cat, data] of Object.entries(categoryStats)) {
    console.log(`   ${cat}: ${data.searches} searches, ${data.newArticles} new articles`);
  }
}

processResults().catch(console.error);
