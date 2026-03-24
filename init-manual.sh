#!/bin/bash
# Manual initialization using solana CLI
set -e

PROGRAM_ID="2RxULUUkU3PwMZVahAjfRgRovVadRRfn7XEqBozGo1d8"
LITTER_MINT="H5RwQLRyBAvVvXbYxzWRYFjXWPjfLtj2dtTPiChRTUK7"
USDC_MINT="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
CLUSTER="devnet"

echo "🚀 Manually initializing LitterBox v2.0..."
echo "Program: $PROGRAM_ID"
echo "LITTER: $LITTER_MINT"
echo "USDC: $USDC_MINT"
echo ""

# Derive PDAs using solana-keygen
CONFIG_SEED="config"
VIRTUAL_POOL_SEED="virtual_pool"

# We'll use anchor to initialize since manual PDA derivation is complex
# For now, let's just verify the program is deployed
solana program show --url $CLUSTER $PROGRAM_ID

echo ""
echo "✅ Program is deployed!"
echo ""
echo "To initialize, run the TypeScript client once IDL issues are resolved"
echo "Or use the Anchor CLI: anchor run initialize"
