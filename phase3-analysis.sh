#!/bin/bash
# Phase 3 Dead Code Detection Script
# Usage: ./phase3-analysis.sh

echo "🔍 Phase 3: Comprehensive Dead Code Detection"
echo "=============================================="

# Create analysis directory
mkdir -p analysis-results

echo "📊 1. Running dependency analysis..."
cd backend && npx depcheck --json > ../analysis-results/backend-depcheck.json 2>/dev/null
cd ../frontend && npx depcheck --json > ../analysis-results/frontend-depcheck.json 2>/dev/null
cd ..

echo "🔍 2. Analyzing unused exports..."
cd backend && npx ts-unused-exports tsconfig.json --showLineNumber > ../analysis-results/backend-unused-exports.txt 2>/dev/null
cd ../frontend && npx ts-unused-exports tsconfig.json --showLineNumber > ../analysis-results/frontend-unused-exports.txt 2>/dev/null
cd ..

echo "📈 3. Running test coverage analysis..."
cd backend && npm run test:coverage > ../analysis-results/backend-coverage.txt 2>&1
cd ../frontend && npm run test:coverage > ../analysis-results/frontend-coverage.txt 2>&1
cd ..

echo "📦 4. Analyzing bundle sizes..."
cd frontend && npm run build > ../analysis-results/frontend-build.txt 2>&1
cd ..

echo "🗂️  5. Finding potentially unused files..."
# Find TypeScript/JavaScript files that aren't imported anywhere
find . -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | \
  grep -v node_modules | \
  grep -v dist | \
  grep -v coverage | \
  grep -v ".test." | \
  grep -v ".spec." > analysis-results/all-source-files.txt

# Count imports for each file
echo "📋 6. Analyzing import patterns..."
grep -r "import.*from" frontend/src backend/src 2>/dev/null | \
  grep -v ".test." | \
  grep -v ".spec." | \
  sed 's/.*from ["\x27]\([^"\x27]*\)["\x27].*/\1/' | \
  sort | uniq -c | sort -nr > analysis-results/import-frequency.txt

echo "✅ Analysis complete! Results saved in analysis-results/"
echo "📋 Summary files created:"
ls -la analysis-results/
