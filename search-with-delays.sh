#!/bin/bash
# Medical Research Scanner - Web Search with Rate Limiting
# Performs searches at 1 req/sec and outputs JSON lines

SEARCH_TERMS=(
  # Conventional
  "Keytruda pembrolizumab bladder cancer|conventional"
  "Padcev enfortumab vedotin urothelial cancer|conventional"
  "pembrolizumab enfortumab combination bladder|conventional"
  # Pipeline
  "BT8009 zelenectide pevedotin nectin-4|pipeline"
  "ETx-22 nectin-4 bladder cancer|pipeline"
  "nectin-4 ADC urothelial cancer trial|pipeline"
  # Integrative
  "low dose naltrexone LDN bladder cancer|integrative"
  "IV vitamin C urothelial cancer|integrative"
  "Angiostop sea cucumber cancer|integrative"
  "fenbendazole cancer clinical|integrative"
  "ivermectin cancer research|integrative"
  "methylene blue cancer mitochondrial|integrative"
  # Trials
  "bladder cancer clinical trial 2025|trials"
  "urothelial carcinoma immunotherapy trial|trials"
  "nectin-4 targeted therapy trial|trials"
  "stage IV bladder cancer new treatment|trials"
  # Research
  "nectin-4 expression bladder cancer|research"
  "checkpoint inhibitor bladder cancer|research"
  "OGF-OGFr axis cancer|research"
  "angiogenesis inhibition bladder cancer|research"
)

echo "🔬 Starting Medical Research Scanner (${#SEARCH_TERMS[@]} searches)" >&2
echo "" >&2

SEARCH_COUNT=0

for term_cat in "${SEARCH_TERMS[@]}"; do
  QUERY="${term_cat%|*}"
  CATEGORY="${term_cat#*|}"
  
  SEARCH_COUNT=$((SEARCH_COUNT + 1))
  echo "[$SEARCH_COUNT/${#SEARCH_TERMS[@]}] Searching: $QUERY" >&2
  
  # Use Python to call Brave Search API directly with proper JSON handling
  RESULT=$(python3 << 'PYEOF'
import os
import json
import urllib.request
import urllib.parse
import sys

api_key = os.environ.get('BRAVE_API_KEY', '')
if not api_key:
    print(json.dumps({"error": "No API key", "query": sys.argv[1], "category": sys.argv[2], "results": []}))
    sys.exit(0)

query = sys.argv[1]
category = sys.argv[2]

params = urllib.parse.urlencode({
    'q': query,
    'count': 5,
    'search_lang': 'en'
})

req = urllib.request.Request(
    f'https://api.search.brave.com/res/v1/web/search?{params}',
    headers={'X-Subscription-Token': api_key, 'Accept': 'application/json'}
)

try:
    with urllib.request.urlopen(req, timeout=10) as response:
        data = json.loads(response.read().decode())
        results = []
        for item in data.get('web', {}).get('results', []):
            results.append({
                'title': item.get('title', ''),
                'url': item.get('url', ''),
                'snippet': item.get('description', ''),
                'source': item.get('extra_snippets', [{}])[0].get('source', 'Unknown') if item.get('extra_snippets') else 'Unknown',
                'age': item.get('age', '')
            })
        print(json.dumps({'query': query, 'category': category, 'results': results}))
except Exception as e:
    print(json.dumps({'error': str(e), 'query': query, 'category': category, 'results': []}))
PYEOF
"$QUERY" "$CATEGORY")
  
  echo "$RESULT"
  
  # Rate limiting: wait 1 second before next search (except for last one)
  if [ $SEARCH_COUNT -lt ${#SEARCH_TERMS[@]} ]; then
    sleep 1
  fi
done

echo "" >&2
echo "✅ All searches complete" >&2
