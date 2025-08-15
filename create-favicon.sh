#!/bin/bash
# Create a square favicon from Cloud-removebg.png using built-in macOS tools

# Use sips (Scriptable Image Processing System) to create a square favicon
cd frontend/public

# Create a 64x64 square version with proper padding
sips -z 64 64 --padToHeightWidth 64 64 --padColor FFFFFF00 Cloud-removebg.png --out Cloud-browsertag.png

echo "Created Cloud-browsertag.png (64x64 square) from Cloud-removebg.png"
