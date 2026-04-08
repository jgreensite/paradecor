#!/bin/bash

# paradecor - Repository Environment Setup Script
# This script acts as the "Memory" for the project's Git configuration.

REMOTE_URL="https://github.com/jgreensite/paradecor"

echo "Checking Git configuration..."

# 1. Ensure the remote 'origin' exists and is correct
CURRENT_REMOTE=$(git remote get-url origin 2>/dev/null)

if [ -z "$CURRENT_REMOTE" ]; then
    echo "⚠️ Remote 'origin' missing. Restoring from memory..."
    git remote add origin "$REMOTE_URL"
    echo "✅ Remote 'origin' added: $REMOTE_URL"
elif [ "$CURRENT_REMOTE" != "$REMOTE_URL" ]; then
    echo "❌ Remote 'origin' mismatch!"
    echo "   Found:    $CURRENT_REMOTE"
    echo "   Expected: $REMOTE_URL"
    read -p "Update remote URL? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git remote set-url origin "$REMOTE_URL"
        echo "✅ Remote URL updated."
    fi
else
    echo "✅ Remote 'origin' is correct."
fi

# 2. Recommended Git Settings
echo "Configuring recommended Git settings..."
git config pull.rebase true
git config fetch.prune true
echo "✅ Local Git settings optimized."

# 3. Clean up VS Code corruption if present
if git config --local --get-regexp "vscode-merge-base" > /dev/null; then
    echo "🧹 Cleaned up legacy VS Code Git configuration entries."
    git config --local --unset-all branch.main.vscode-merge-base 2>/dev/null
    # Unset for other branches if needed
fi

echo "🚀 Repository environment is stable."
