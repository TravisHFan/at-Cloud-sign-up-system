#!/usr/bin/env python3
"""
Extract registerGuest method from guestController.ts and replace with delegation.
This ensures exact copy methodology with no AI rewrites.
"""

# Read the original file
with open('src/controllers/guestController.ts', 'r') as f:
    lines = f.readlines()

# Find the registerGuest method boundaries
# It starts at line 81 (index 80) with "static async registerGuest"
# and ends at line 782 (index 781) with the closing brace

# The delegation replacement
delegation = """  /**
   * Register a guest for an event role
   * POST /api/events/:eventId/guest-signup
   */
  static async registerGuest(req: Request, res: Response): Promise<void> {
    const { GuestRegistrationController } = await import(
      "./guest/GuestRegistrationController"
    );
    return GuestRegistrationController.registerGuest(req, res);
  }

"""

# Build new file: lines 0-77 (header) + delegation + lines 783+ (rest of methods)
new_lines = lines[0:77] + [delegation] + lines[783:]

# Write the modified file
with open('src/controllers/guestController.ts', 'w') as f:
    f.writelines(new_lines)

print("✅ Successfully replaced registerGuest with delegation")
print(f"   Original lines: {len(lines)}")
print(f"   New lines: {len(new_lines)}")
print(f"   Saved: {len(lines) - len(new_lines)} lines")
