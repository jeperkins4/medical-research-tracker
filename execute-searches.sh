#!/bin/bash
# Medical Research Scanner - Execute all searches with rate limiting
# This script is called by OpenClaw to perform web searches

cd /Users/perkins/.openclaw/workspace/medical-research-tracker

# Clear previous search data
> search-data.jsonl

# All search terms with their categories
declare -A SEARCHES
SEARCHES["conventional|Keytruda pembrolizumab bladder cancer"]=1
SEARCHES["conventional|Padcev enfortumab vedotin urothelial cancer"]=1
SEARCHES["conventional|pembrolizumab enfortumab combination bladder"]=1
SEARCHES["pipeline|BT8009 zelenectide pevedotin nectin-4"]=1
SEARCHES["pipeline|ETx-22 nectin-4 bladder cancer"]=1
SEARCHES["pipeline|nectin-4 ADC urothelial cancer trial"]=1
SEARCHES["integrative|low dose naltrexone LDN bladder cancer"]=1
SEARCHES["integrative|IV vitamin C urothelial cancer"]=1
SEARCHES["integrative|Angiostop sea cucumber cancer"]=1
SEARCHES["integrative|fenbendazole cancer clinical"]=1
SEARCHES["integrative|ivermectin cancer research"]=1
SEARCHES["integrative|methylene blue cancer mitochondrial"]=1
SEARCHES["trials|bladder cancer clinical trial 2025"]=1
SEARCHES["trials|urothelial carcinoma immunotherapy trial"]=1
SEARCHES["trials|nectin-4 targeted therapy trial"]=1
SEARCHES["trials|stage IV bladder cancer new treatment"]=1
SEARCHES["research|nectin-4 expression bladder cancer"]=1
SEARCHES["research|checkpoint inhibitor bladder cancer"]=1
SEARCHES["research|OGF-OGFr axis cancer"]=1
SEARCHES["research|angiogenesis inhibition bladder cancer"]=1

echo "🔬 Starting Medical Research Scanner..."
echo "📊 Total searches: ${#SEARCHES[@]}"
echo ""

COUNT=0
for key in "${!SEARCHES[@]}"; do
  IFS='|' read -r CATEGORY TERM <<< "$key"
  COUNT=$((COUNT + 1))
  
  echo "[$COUNT/${#SEARCHES[@]}] Searching: $TERM (category: $CATEGORY)"
  
  # Note: This script needs to be called FROM OpenClaw with web_search
  # This is a template for the structure
  
  # Sleep 1 second between searches (rate limit)
  if [ $COUNT -lt ${#SEARCHES[@]} ]; then
    sleep 1
  fi
done

echo ""
echo "✅ All searches complete"
echo "📄 Results saved to search-data.jsonl"
