#!/usr/bin/env node
/**
 * Medical Research Scanner Runner
 * Called by OpenClaw cron job with search results
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'data', 'health.db');

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

// Process search results from stdin (JSONL format)
async function processResults() {
  const db = new Database(dbPath);
  
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO news_feed (title, url, snippet, source, published_date, search_term, relevance_score)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  let totalNew = 0;
  let totalProcessed = 0;
  const categoryStats = {};
  
  const input = await new Promise((resolve) => {
    let data = '';
    process.stdin.on('data', chunk => data += chunk);
    process.stdin.on('end', () => resolve(data));
  });
  
  const lines = input.trim().split('\n').filter(l => l);
  
  for (const line of lines) {
    try {
      const { term, category, results } = JSON.parse(line);
      
      if (!categoryStats[category]) categoryStats[category] = 0;
      
      for (const result of results) {
        totalProcessed++;
        
        const relevance = calculateRelevance(result.title, result.description || '');
        
        if (relevance > 0) {
          try {
            const info = stmt.run(
              result.title,
              result.url,
              result.description || '',
              result.siteName || 'Unknown',
              result.published || null,
              term,
              relevance
            );
            
            if (info.changes > 0) {
              totalNew++;
              categoryStats[category]++;
            }
          } catch (err) {
            // Duplicate URL, skip
          }
        }
      }
    } catch (err) {
      console.error('Parse error:', err.message);
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
  console.log('✅ Medical Research Scanner Complete\n');
  console.log(`📊 Summary:`);
  console.log(`   • Total searches: ${Object.values(SEARCH_TERMS).flat().length}`);
  console.log(`   • Results processed: ${totalProcessed}`);
  console.log(`   • New articles saved: ${totalNew}`);
  console.log(`   • Database total: ${stats.total} articles`);
  console.log(`   • Unread: ${stats.unread}\n`);
  
  if (totalNew > 0) {
    console.log(`📂 New articles by category:`);
    for (const [cat, count] of Object.entries(categoryStats)) {
      if (count > 0) {
        console.log(`   • ${cat}: ${count}`);
      }
    }
  }
}

processResults().catch(console.error);
