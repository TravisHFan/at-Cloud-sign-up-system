#!/bin/bash

# Navigate to backend directory
cd "/Users/dr.hunter/CS Projects/at-Cloud-sign-up-system/backend"

echo "🔄 Starting user data regeneration..."

# Run the regeneration script
npm run regenerate-users

echo "✅ User regeneration script completed"
