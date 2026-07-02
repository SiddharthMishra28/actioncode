#!/bin/bash

# Run OpenCode with instruction
# Usage: ./run-opencode.sh "instruction" [model]

set -e

INSTRUCTION=$1
MODEL=${2:-"opencode/free-model"}

if [ -z "$INSTRUCTION" ]; then
  echo "Error: Instruction is required"
  echo "Usage: ./run-opencode.sh \"instruction\" [model]"
  exit 1
fi

echo "Running OpenCode with instruction: $INSTRUCTION"
echo "Model: $MODEL"

# Create temporary instruction file
echo "$INSTRUCTION" > /tmp/instruction.txt

# Run OpenCode
opencode \
  --model "$MODEL" \
  --instruction "$(cat /tmp/instruction.txt)" \
  --non-interactive \
  --auto-approve \
  --verbose \
  2>&1 | tee /tmp/opencode-output.txt

EXIT_CODE=${PIPESTATUS[0]}

# Cleanup
rm -f /tmp/instruction.txt

if [ $EXIT_CODE -eq 0 ]; then
  echo "OpenCode executed successfully"
  
  # Get modified files
  MODIFIED_FILES=$(git diff --name-only 2>/dev/null || echo "")
  if [ -n "$MODIFIED_FILES" ]; then
    echo "Modified files:"
    echo "$MODIFIED_FILES"
  else
    echo "No files were modified"
  fi
else
  echo "OpenCode failed with exit code: $EXIT_CODE"
  exit $EXIT_CODE
fi
