#!/bin/bash

echo "Starting React Scripts upgrade process..."

# Backup package.json and package-lock.json
cp package.json package.json.backup
cp package-lock.json package-lock.json.backup

# Remove existing react-scripts
npm uninstall react-scripts

# Install latest stable version of react-scripts
npm install --save react-scripts@latest

# Clean and rebuild
npm cache clean --force
rm -rf node_modules
npm install

# Run security audit
echo "Running final security audit..."
npm audit

echo "React Scripts upgrade complete. If the application fails to run, restore the backups with:"
echo "mv package.json.backup package.json"
echo "mv package-lock.json.backup package-lock.json"
echo "npm install" 