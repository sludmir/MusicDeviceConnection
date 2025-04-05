#!/bin/bash

echo "Starting targeted vulnerability fixes..."

# Update react-scripts dependencies safely
npm install --save-dev \
  @svgr/webpack@latest \
  svgo@latest \
  css-select@latest \
  nth-check@latest \
  postcss@latest \
  resolve-url-loader@latest

# Force update specific packages while preserving React functionality
npm install --save --force \
  nth-check@latest \
  postcss@latest

# Clean npm cache
npm cache clean --force

# Rebuild node modules
rm -rf node_modules
npm install

# Run final audit
echo "Running final security audit..."
npm audit

echo "Targeted vulnerability fixes complete. Please test the application thoroughly." 