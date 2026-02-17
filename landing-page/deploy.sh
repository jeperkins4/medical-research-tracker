#!/bin/bash

# Deploy MRT Landing Page to Vercel
# Usage: ./deploy.sh [production]

set -e  # Exit on error

echo "🚀 Deploying MyTreatmentPath Landing Page to Vercel..."
echo ""

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Installing..."
    npm install -g vercel
    echo "✅ Vercel CLI installed"
    echo ""
fi

# Check if user is logged in
if ! vercel whoami &> /dev/null; then
    echo "🔐 Not logged in to Vercel. Please authenticate..."
    vercel login
    echo ""
fi

# Determine deployment type
if [ "$1" == "production" ] || [ "$1" == "prod" ] || [ "$1" == "--prod" ]; then
    echo "📦 Deploying to PRODUCTION..."
    vercel --prod
else
    echo "📦 Deploying to PREVIEW..."
    echo "   (Use './deploy.sh production' to deploy to production)"
    vercel
fi

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Visit the URL above to view your site"
echo "2. Test all download links"
echo "3. Share on social media 🎉"
echo ""
