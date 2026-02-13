# AI Healthcare Strategy Summary - Quick Setup

## What It Does

Analyzes your complete healthcare data and generates a strategic synthesis:

- **Strategy Overview** → How your genomics, diet, supplements, and research work together
- **Alignment Analysis** → ARID1A/CDKN1A/MLL2/TERT → pathways → treatments → diet connections  
- **Coverage Gaps** → Pathways or mutations not adequately addressed
- **Research Opportunities** → Specific search terms, clinical trial categories to explore
- **Data Quality** → Missing vitals/labs/biomarkers that would strengthen optimization

**Goal:** Optimize your longevity strategy with AI-powered insights. No prognosis predictions — just actionable intelligence.

## Setup (2 minutes)

### 1. Get OpenAI API Key

Visit https://platform.openai.com/api-keys and create a new key.

### 2. Configure Environment

```bash
cd ~/.openclaw/workspace/medical-research-tracker

# Create .env file
echo "OPENAI_API_KEY=sk-..." > .env
# Replace sk-... with your actual key
```

### 3. Restart Server

```bash
# If server is running, stop it (Ctrl+C)
npm run server
```

### 4. Generate Summary

1. Open http://localhost:5173
2. Click **🧠 Strategy** tab
3. Click **✨ Generate Summary**
4. Wait ~15-30 seconds

## Privacy Note

Your health data is sent to OpenAI's API for analysis. The prompt includes:
- Genomic mutations and pathways
- Medications/supplements (names, dosages, genomic correlations)
- Dietary habits
- Research paper titles/abstracts
- Recent vitals and lab results

If this is a concern, don't configure the API key. All other features work without it.

## Cost

OpenAI charges per token:
- GPT-4o: ~$5 per 1M input tokens, ~$15 per 1M output tokens
- Typical summary generation: ~8,000 input + ~2,500 output tokens
- **Cost per summary: ~$0.08** (8 cents)

Generate as often as you want — it's designed to reflect your current data snapshot.

## Troubleshooting

**Error: "OpenAI API key not configured"**
- Check `.env` file exists in project root
- Verify `OPENAI_API_KEY=sk-...` is set
- Restart the server

**Error: "Invalid API key"**
- Regenerate key at https://platform.openai.com/api-keys
- Make sure there are no spaces or quotes around the key in `.env`

**Summary takes too long**
- Normal for comprehensive analysis (15-45 seconds)
- Check server console for progress/errors

**Summary quality issues**
- Model uses temp 0.3 for consistency
- If results are unexpected, regenerate (each run is slightly different)
- Consider adding more data (recent labs, papers, dietary notes)

## What Gets Analyzed

From your database:
- ✅ Patient profile (age, conditions)
- ✅ 4 confirmed genomic mutations
- ✅ 6 affected pathways
- ✅ 13+ genomic treatment opportunities
- ✅ 19 current medications/supplements
- ✅ Treatment-genomic correlations (Dr. Gildea's protocol)
- ✅ Dietary habits (philosophy + routines)
- ✅ Research library (recent 20 papers with tags)
- ✅ Recent vitals (last 10 readings)
- ✅ Recent labs (last 20 results)

The more complete your data, the better the insights.
