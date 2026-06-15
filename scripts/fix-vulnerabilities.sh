#!/bin/bash

echo "Starting vulnerability fixes..."

# Update dependencies with security fixes
npm audit fix

# Force update critical dependencies while preserving React functionality
npm install --save \
  @babel/helpers@latest \
  @babel/runtime@latest \
  body-parser@latest \
  cookie@latest \
  cross-spawn@latest \
  http-proxy-middleware@latest \
  micromatch@latest \
  nanoid@latest \
  path-to-regexp@latest \
  rollup@latest \
  send@latest \
  webpack@latest \
  ws@latest

# Run audit again to verify fixes
echo "Running final security audit..."
npm audit

echo "Vulnerability fixes complete. Please check the application functionality." 