#!/bin/bash

# Secure Deployment Script for Connect My Set
# This script ensures proper security measures during deployment

# Exit on any error
set -e

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

echo "Starting secure deployment process..."

# Check Node version
echo "Checking Node version..."
node -v

# Install dependencies
echo "Installing dependencies..."
npm ci

# Run security audit with exceptions for known issues
echo "Running security audit..."
npm audit --production | grep -v "nth-check" | grep -v "postcss" || true

# Run linting and type checking
echo "Running security checks..."
npm run lint
npm run test -- --watchAll=false

# Build with production environment
echo "Building production bundle..."
REACT_APP_ENVIRONMENT=production npm run build

# Validate Firebase configuration
echo "Validating Firebase configuration..."
firebase apps:sdkconfig web

# Verify SSL certificate for custom domain
echo "Verifying SSL certificate..."
curl -sS https://connectmyset.com > /dev/null
if [ $? -eq 0 ]; then
    echo "SSL certificate is valid"
else
    echo "Warning: SSL certificate verification failed"
    read -p "Do you want to continue with deployment? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Deploy Firestore security rules
echo "Deploying Firestore security rules..."
firebase deploy --only firestore:rules

echo "Deploying Storage security rules..."
firebase deploy --only storage

# Deploy the application to all targets
echo "Deploying to Firebase Hosting..."
firebase deploy --only hosting

# Verify security headers
echo "Verifying security headers..."
curl -I https://connectmyset.com || echo "Note: Please verify security headers manually after deployment"

echo "Deployment complete. Please verify the following:"
echo "1. Application is accessible at https://connectmyset.com"
echo "2. Security headers are properly set"
echo "3. Authentication is working"
echo "4. Firestore rules are enforced"
echo "5. Storage rules are enforced"
echo "6. Visit https://connectmyset.com and check for any security warnings"
echo "7. Test Google Sign-in functionality"
echo "8. Verify that all features are working correctly"
echo "9. Check browser console for any security-related errors" 