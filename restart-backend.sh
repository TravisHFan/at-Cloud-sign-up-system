#!/bin/bash

echo "🔄 Restarting backend with enhanced scheduler logging..."

# Kill existing backend processes
pkill -f "npm.*dev" || true
pkill -f "nodemon" || true
pkill -f "node.*dist" || true

# Wait for processes to stop
sleep 3

echo "✅ Previous processes stopped"

# Start fresh backend
cd /Users/dr.hunter/CS\ Projects/at-Cloud-sign-up-system/backend
npm run dev
