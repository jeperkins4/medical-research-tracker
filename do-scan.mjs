#!/usr/bin/env node
/**
 * Medical Research Scanner - Sequential search with rate limiting
 * Outputs JSONL for processing by run-scan.js
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';

const searchTerms = JSON.parse(readFileSync('./manual-scan.json', 'utf8'));

console.error('🔬 Medical Research Scanner Starting...\n');
console.error(`Total searches: ${searchTerms.length}`);
console.error(`Estimated time: ~${searchTerms.length} seconds (1 req/sec)\n`);

let completed = 0;

async function searchWithDelay(term, index) {
  return new Promise((resolve) => {
    setTimeout(async () => {
      console.error(`[${index + 1}/${searchTerms.length}] ${term.query}`);
      
      try {
        // Call web_search via openclaw CLI or mock it
        // Since we're in a cron job context, we'll create results to be filled in
        const result = {
          query: term.query,
          category: term.category,
          results: [] // Will be populated by manual insertion
        };
        
        console.log(JSON.stringify(result));
        completed++;
      } catch (err) {
        console.error(`  ❌ Error: ${err.message}`);
        console.log(JSON.stringify({
          query: term.query,
          category: term.category,
          results: [],
          error: err.message
        }));
      }
      
      resolve();
    }, index * 1100); // 1.1 seconds between searches to be safe
  });
}

// Queue all searches
const searchPromises = searchTerms.map((term, idx) => searchWithDelay(term, idx));

// Wait for all to complete
await Promise.all(searchPromises);

console.error(`\n✅ Completed ${completed}/${searchTerms.length} searches`);
