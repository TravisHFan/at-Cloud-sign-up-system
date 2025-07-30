#!/bin/bash

# Event Creation System Message Fix - Manual Verification Script
# This script tests if the event creation fix is working correctly

echo "🔔 Testing Event Creation System Message Fix"
echo "============================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

BASE_URL="http://localhost:5002/api/v1"

echo -e "${BLUE}📋 Step 1: Checking backend server status...${NC}"
response=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/health")
if [ "$response" -eq 200 ]; then
    echo -e "${GREEN}✅ Backend server is running${NC}"
else
    echo -e "${RED}❌ Backend server is not responding (HTTP $response)${NC}"
    exit 1
fi

echo -e "${BLUE}📋 Step 2: Testing with existing admin user...${NC}"

# Try to login with a test admin (this requires an existing admin user)
echo -e "${YELLOW}🔑 Attempting login...${NC}"

login_response=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "emailOrUsername": "admin@atcloud.com",
    "password": "Admin123!"
  }')

echo "Login response: $login_response"

# Extract token if login successful
token=$(echo "$login_response" | grep -o '"accessToken":"[^"]*"' | sed 's/"accessToken":"//;s/"//')

if [ -n "$token" ]; then
    echo -e "${GREEN}✅ Login successful${NC}"
    
    echo -e "${BLUE}📋 Step 3: Counting system messages before event creation...${NC}"
    
    # Get current system message count
    messages_before=$(curl -s "$BASE_URL/system-messages" \
      -H "Authorization: Bearer $token" | \
      grep -o '"totalCount":[0-9]*' | \
      sed 's/"totalCount"://')
    
    echo -e "${YELLOW}📊 System messages before: $messages_before${NC}"
    
    echo -e "${BLUE}📋 Step 4: Creating test event...${NC}"
    
    # Create test event
    event_data='{
      "title": "System Message Test Event",
      "type": "Workshop", 
      "description": "Testing system message creation",
      "date": "2025-08-05",
      "time": "10:00",
      "endTime": "12:00",
      "organizer": "Test Admin",
      "purpose": "Testing system message functionality",
      "format": "Online",
      "zoomLink": "https://zoom.us/test",
      "roles": ["Developer"],
      "maxParticipants": 20,
      "registrationDeadline": "2025-08-03"
    }'
    
    event_response=$(curl -s -X POST "$BASE_URL/events" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $token" \
      -d "$event_data")
    
    echo "Event creation response: $event_response"
    
    # Check if event was created successfully
    if echo "$event_response" | grep -q '"success":true'; then
        echo -e "${GREEN}✅ Event created successfully${NC}"
        
        # Wait for system message creation
        echo -e "${YELLOW}⏳ Waiting 3 seconds for system message creation...${NC}"
        sleep 3
        
        echo -e "${BLUE}📋 Step 5: Counting system messages after event creation...${NC}"
        
        # Get system message count after event creation
        messages_after=$(curl -s "$BASE_URL/system-messages" \
          -H "Authorization: Bearer $token" | \
          grep -o '"totalCount":[0-9]*' | \
          sed 's/"totalCount"://')
        
        echo -e "${YELLOW}📊 System messages after: $messages_after${NC}"
        
        # Calculate difference
        if [ -n "$messages_before" ] && [ -n "$messages_after" ]; then
            diff=$((messages_after - messages_before))
            echo -e "${YELLOW}📈 New messages created: $diff${NC}"
            
            if [ "$diff" -gt 0 ]; then
                echo -e "${GREEN}🎉 SUCCESS: Event creation fix is working! System messages were created.${NC}"
            else
                echo -e "${RED}❌ ISSUE: No new system messages created. Fix may not be working.${NC}"
            fi
        else
            echo -e "${YELLOW}⚠️  Could not determine message count difference${NC}"
        fi
        
    else
        echo -e "${RED}❌ Event creation failed${NC}"
    fi
    
else
    echo -e "${RED}❌ Login failed - cannot test event creation${NC}"
    echo -e "${YELLOW}💡 Make sure you have an admin user with credentials:${NC}"
    echo -e "${YELLOW}   Email: admin@atcloud.com${NC}"
    echo -e "${YELLOW}   Password: Admin123!${NC}"
fi

echo -e "${BLUE}=============================================${NC}"
echo -e "${BLUE}🔔 Event Creation System Message Test Complete${NC}"
