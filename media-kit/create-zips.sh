#!/bin/bash
# Script to create ZIP files for Tanda Media Kit
# Run this from the media-kit directory

echo "Creating Tanda Media Kit ZIP files..."

# Create logos ZIP
echo "Creating logos ZIP..."
cd logos
zip -r ../tanda-logo-full.zip *.svg *.png 2>/dev/null
cd ..

# Create screenshots ZIP
echo "Creating screenshots ZIP..."
cd screenshots
zip -r ../app-screenshots.zip *.png *.jpg 2>/dev/null
cd ..

# Create complete media kit ZIP
echo "Creating complete media kit ZIP..."
zip -r media-kit.zip logos/ screenshots/ brand-assets/ 2>/dev/null

echo "Done! ZIP files created:"
echo "  - tanda-logo-full.zip (logos)"
echo "  - app-screenshots.zip (screenshots)"
echo "  - media-kit.zip (complete kit)"

