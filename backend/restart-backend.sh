#!/bin/bash

echo "🔄 Restarting backend with updated rate limits..."

# Navigate to backend directory
cd "$(dirname "$0")"

# Kill existing processes
echo "Stopping existing backend processes..."
pkill -f "npm run dev" 2>/dev/null || true
pkill -f "nodemon" 2>/dev/null || true

# Wait a moment
sleep 2

# Start the backend
echo "Starting backend with new rate limits (1000 requests per 15 minutes)..."
npm run dev

echo "✅ Backend restarted! Rate limits increased for development."
