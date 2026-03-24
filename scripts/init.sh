#!/bin/bash
# Initialize LitterBox v2.0 Protocol

set -e

PROGRAM_ID="2RxULUUkU3PwMZVahAjfRgRovVadRRfn7XEqBozGo1d8"
LITTER_MINT="H5RwQLRyBAvVvXbYxzWRYFjXWPjfLtj2dtTPiChRTUK7"
USDC_MINT="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"

echo "🚀 Initializing LitterBox v2.0 Protocol..."
echo ""
echo "Program ID: $PROGRAM_ID"
echo "LITTER Mint: $LITTER_MINT"
echo "USDC Mint: $USDC_MINT"
echo ""

# Export environment variables
export ANCHOR_PROVIDER_URL="https://api.devnet.solana.com"
export ANCHOR_WALLET="$HOME/.config/solana/id.json"
export LITTERBOX_PROGRAM_ID="$PROGRAM_ID"
export LITTER_MINT="$LITTER_MINT"
export USDC_MINT="$USDC_MINT"

# Run initialization using anchor
cd /home/jay/.openclaw/workspace/litterbox-v2

# Use anchor run to execute the initialize script
npx ts-node -r tsconfig-paths/register scripts/initialize.ts \
  --graduation-threshold=1000000000 \
  --virtual-initial-usdc=1000000000 \
  --virtual-initial-litter=1000000000000000000
