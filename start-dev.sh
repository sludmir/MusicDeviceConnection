#!/bin/bash
export NODE_OPTIONS="--max-old-space-size=4096"
export BROWSER=none
export GENERATE_SOURCEMAP=false
export SKIP_PREFLIGHT_CHECK=true
npm start
