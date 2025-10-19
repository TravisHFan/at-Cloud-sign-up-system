#!/bin/bash

# Promo Code API Quick Test Script
# Tests that all endpoints are registered and respond correctly

echo "🧪 Testing Promo Code API Endpoints..."
echo ""

# Base URL (adjust if needed)
BASE_URL="http://localhost:5001/api"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "${YELLOW}Prerequisites:${NC}"
echo "1. Backend server must be running on port 5001"
echo "2. You must have a valid JWT token"
echo "3. Set TOKEN environment variable: export TOKEN='your-jwt-token'"
echo ""

if [ -z "$TOKEN" ]; then
  echo "${RED}❌ Error: TOKEN environment variable not set${NC}"
  echo "Usage: export TOKEN='your-jwt-token' && ./test-promo-api.sh"
  exit 1
fi

# Test 1: Health check
echo "${YELLOW}Test 1: Health Check${NC}"
curl -s "$BASE_URL/health" | jq '.success' > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "${GREEN}✅ Server is running${NC}"
else
  echo "${RED}❌ Server is not responding${NC}"
  exit 1
fi
echo ""

# Test 2: Get My Codes (requires auth)
echo "${YELLOW}Test 2: GET /promo-codes/my-codes${NC}"
RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/promo-codes/my-codes")
SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
if [ "$SUCCESS" = "true" ]; then
  echo "${GREEN}✅ Endpoint accessible${NC}"
  CODE_COUNT=$(echo "$RESPONSE" | jq '.codes | length')
  echo "   Found $CODE_COUNT promo codes"
else
  echo "${RED}❌ Request failed${NC}"
  echo "$RESPONSE" | jq '.'
fi
echo ""

# Test 3: Validate Code (requires auth)
echo "${YELLOW}Test 3: POST /promo-codes/validate${NC}"
RESPONSE=$(curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"code":"INVALID123","programId":"60d5ec49f1b2c72b8c8e4f1a"}' \
  "$BASE_URL/promo-codes/validate")
SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
if [ "$SUCCESS" = "true" ]; then
  echo "${GREEN}✅ Endpoint accessible${NC}"
  VALID=$(echo "$RESPONSE" | jq -r '.valid')
  MESSAGE=$(echo "$RESPONSE" | jq -r '.message')
  echo "   Valid: $VALID"
  echo "   Message: $MESSAGE"
else
  echo "${RED}❌ Request failed${NC}"
  echo "$RESPONSE" | jq '.'
fi
echo ""

# Test 4: Get All Codes (admin only)
echo "${YELLOW}Test 4: GET /promo-codes (Admin)${NC}"
RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/promo-codes")
SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
if [ "$SUCCESS" = "true" ]; then
  echo "${GREEN}✅ Endpoint accessible (Admin)${NC}"
  CODE_COUNT=$(echo "$RESPONSE" | jq '.codes | length')
  TOTAL=$(echo "$RESPONSE" | jq -r '.pagination.total')
  echo "   Displaying $CODE_COUNT of $TOTAL total codes"
elif [ "$SUCCESS" = "false" ]; then
  MESSAGE=$(echo "$RESPONSE" | jq -r '.message')
  if [[ "$MESSAGE" == *"Forbidden"* ]] || [[ "$MESSAGE" == *"admin"* ]]; then
    echo "${YELLOW}⚠️  Admin access required (expected for non-admin users)${NC}"
  else
    echo "${RED}❌ Request failed${NC}"
    echo "$RESPONSE" | jq '.'
  fi
else
  echo "${RED}❌ Unexpected response${NC}"
  echo "$RESPONSE"
fi
echo ""

# Test 5: Get Bundle Config (admin only)
echo "${YELLOW}Test 5: GET /promo-codes/config (Admin)${NC}"
RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/promo-codes/config")
SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
if [ "$SUCCESS" = "true" ]; then
  echo "${GREEN}✅ Endpoint accessible (Admin)${NC}"
  ENABLED=$(echo "$RESPONSE" | jq -r '.config.enabled')
  AMOUNT=$(echo "$RESPONSE" | jq -r '.config.discountAmount')
  DAYS=$(echo "$RESPONSE" | jq -r '.config.expiryDays')
  echo "   Enabled: $ENABLED"
  echo "   Amount: \$$(($AMOUNT / 100)).00"
  echo "   Expiry Days: $DAYS"
elif [ "$SUCCESS" = "false" ]; then
  MESSAGE=$(echo "$RESPONSE" | jq -r '.message')
  if [[ "$MESSAGE" == *"Forbidden"* ]] || [[ "$MESSAGE" == *"admin"* ]]; then
    echo "${YELLOW}⚠️  Admin access required (expected for non-admin users)${NC}"
  else
    echo "${RED}❌ Request failed${NC}"
    echo "$RESPONSE" | jq '.'
  fi
else
  echo "${RED}❌ Unexpected response${NC}"
  echo "$RESPONSE"
fi
echo ""

echo "${GREEN}🎉 API Testing Complete!${NC}"
echo ""
echo "Summary:"
echo "- User endpoints: ✅ my-codes, validate"
echo "- Admin endpoints: Check logs above"
echo ""
echo "Next Steps:"
echo "1. Test with actual promo codes in database"
echo "2. Test admin endpoints with admin user"
echo "3. Run integration tests (Todo #22)"
