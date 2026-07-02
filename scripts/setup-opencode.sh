#!/bin/bash

# Setup OpenCode for non-interactive execution
# Usage: ./setup-opencode.sh [model]

set -e

MODEL=${1:-"opencode/free-model"}

echo "Setting up OpenCode with model: $MODEL"

# Create OpenCode config directory
mkdir -p ~/.opencode

# Create configuration file
cat > ~/.opencode/config.json << EOF
{
  "model": "$MODEL",
  "autoApprove": true,
  "nonInteractive": true,
  "verbose": true,
  "maxTokens": 4096,
  "temperature": 0.7,
  "timeout": 300,
  "retryAttempts": 3,
  "retryDelay": 5000
}
EOF

echo "OpenCode configuration created at ~/.opencode/config.json"

# Verify OpenCode is installed
if command -v opencode &> /dev/null; then
  echo "OpenCode version: $(opencode --version)"
else
  echo "Warning: OpenCode is not installed"
  echo "Install with: npm install -g opencode"
fi
