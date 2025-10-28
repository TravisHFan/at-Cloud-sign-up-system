#!/bin/bash

# Script to update test files from mocking EmailServiceFacade to spying on domain services
# Phase 2.3 of the giant file refactoring project

echo "🔄 Phase 2.3: Updating tests to spy on domain services instead of mocking EmailServiceFacade"
echo ""

# Function to update a test file
update_test_file() {
    local file=$1
    local domain_service=$2
    local methods=$3
    
    echo "📝 Updating $file to use $domain_service..."
    
    # 1. Remove vi.mock for EmailServiceFacade
    perl -i -p0e 's/vi\.mock\(".*EmailServiceFacade".*?\{[^}]*EmailService:[^}]*\}\s*\}\);?\n//gs' "$file"
    
    # 2. Update import statement
    perl -pi -e "s/import \{ EmailService \} from \".*EmailServiceFacade\";/import { $domain_service } from \".*\";/g" "$file"
    
    # 3. Replace all EmailService. with the domain service name
    perl -pi -e "s/\bEmailService\./$domain_service./g" "$file"
    
    echo "✅ $file updated"
}

# Update files based on domain
echo "Starting updates..."
echo ""

# 1. authController.test.ts - already done manually as example
echo "✅ authController.test.ts already updated (manual example)"

# 2. guestController.test.ts
perl -i -p0e 's/vi\.mock\("\.\.\/\.\.\/\.\.\/src\/services\/infrastructure\/EmailServiceFacade".*?\}\);\n//gs' tests/unit/controllers/guestController.test.ts
perl -pi -e 's/import \{ EmailService \} from "\.\.\/\.\.\/\.\.\/src\/services\/infrastructure\/EmailServiceFacade";/import { GuestEmailService } from "..\/..\/..\/src\/services\/email\/domains\/GuestEmailService";/' tests/unit/controllers/guestController.test.ts
perl -pi -e 's/\bEmailService\./GuestEmailService./g' tests/unit/controllers/guestController.test.ts
echo "✅ guestController.test.ts updated"

# 3. emailNotificationController.test.ts
perl -i -p0e 's/vi\.mock\("\.\.\/\.\.\/\.\.\/src\/services\/infrastructure\/EmailServiceFacade".*?\}\);\n//gs' tests/unit/controllers/emailNotificationController.test.ts
perl -pi -e 's/import \{ EmailService \} from "\.\.\/\.\.\/\.\.\/src\/services\/infrastructure\/EmailServiceFacade";/import { EventEmailService } from "..\/..\/..\/src\/services\/email\/domains\/EventEmailService";/' tests/unit/controllers/emailNotificationController.test.ts
perl -pi -e 's/\bEmailService\./EventEmailService./g' tests/unit/controllers/emailNotificationController.test.ts
echo "✅ emailNotificationController.test.ts updated"

# 4. eventController.mentorCircle.test.ts
perl -i -p0e 's/vi\.mock\("\.\.\/\.\.\/\.\.\/src\/services\/infrastructure\/EmailServiceFacade".*?\}\);\n//gs' tests/unit/controllers/eventController.mentorCircle.test.ts
perl -pi -e 's/import \{ EmailService \} from "\.\.\/\.\.\/\.\.\/src\/services\/infrastructure\/EmailServiceFacade";/import { EventEmailService } from "..\/..\/..\/src\/services\/email\/domains\/EventEmailService";/' tests/unit/controllers/eventController.mentorCircle.test.ts
perl -pi -e 's/\bEmailService\./EventEmailService./g' tests/unit/controllers/eventController.mentorCircle.test.ts
echo "✅ eventController.mentorCircle.test.ts updated"

echo ""
echo "✨ Phase 2.3 updates complete!"
echo "📊 Next step: Run 'npm test' to verify all tests still pass"
