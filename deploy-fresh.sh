#!/bin/bash
# Clean deployment script for LitterBox v2.0
set -e

echo "🔍 Verifying configuration..."

# Check Anchor version
ANCHOR_TOML_VERSION=$(grep "anchor_version" Anchor.toml | grep -oE "[0-9]+\.[0-9]+\.[0-9]+")
PACKAGE_VERSION=$(grep '"@coral-xyz/anchor"' package.json | grep -oE "[0-9]+\.[0-9]+\.[0-9]+")
echo "Anchor.toml version: $ANCHOR_TOML_VERSION"
echo "Package.json version: $PACKAGE_VERSION"

if [ "$ANCHOR_TOML_VERSION" != "$PACKAGE_VERSION" ]; then
  echo "⚠️  WARNING: Version mismatch (may still work)"
fi

# Check lib.rs ID
LIB_ID=$(grep "declare_id" programs/litterbox-v2/src/lib.rs | grep -oE "2kTagoG2k|2RxULUUk|EqPiWgCG" | head -1)
if [ "$LIB_ID" == "2kTagoG2k" ]; then
  LIB_ID_FULL="2kTagoG2kxo9TqBE8iUvHs2FanwpqDpggG9wkHNjTvB8"
elif [ "$LIB_ID" == "2RxULUUk" ]; then
  LIB_ID_FULL="2RxULUUkU3PwMZVahAjfRgRovVadRRfn7XEqBozGo1d8"
elif [ "$LIB_ID" == "EqPiWgCG" ]; then
  LIB_ID_FULL="EqPiWgCG671GmkFMZTtn6GcUt2Xbc2p8rzj17dgFKX7m"
else
  echo "❌ ERROR: Could not find program ID in lib.rs"
  exit 1
fi
echo "lib.rs ID: $LIB_ID_FULL"

# Check Anchor.toml ID
ANCHOR_ID=$(grep "litterbox_v2 = " Anchor.toml | grep devnet -A1 | grep -oE "2kTagoG2k|2RxULUUk|EqPiWgCG" | head -1)
if [ "$ANCHOR_ID" == "2kTagoG2k" ]; then
  ANCHOR_ID_FULL="2kTagoG2kxo9TqBE8iUvHs2FanwpqDpggG9wkHNjTvB8"
elif [ "$ANCHOR_ID" == "2RxULUUk" ]; then
  ANCHOR_ID_FULL="2RxULUUkU3PwMZVahAjfRgRovVadRRfn7XEqBozGo1d8"
elif [ "$ANCHOR_ID" == "EqPiWgCG" ]; then
  ANCHOR_ID_FULL="EqPiWgCG671GmkFMZTtn6GcUt2Xbc2p8rzj17dgFKX7m"
else
  echo "❌ ERROR: Could not find program ID in Anchor.toml"
  exit 1
fi
echo "Anchor.toml ID: $ANCHOR_ID_FULL"

if [ "$LIB_ID_FULL" != "$ANCHOR_ID_FULL" ]; then
  echo "❌ ERROR: IDs don't match between lib.rs and Anchor.toml!"
  exit 1
fi

echo "✅ IDs match: $LIB_ID_FULL"
echo ""

# Export environment
export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$PATH"
export ANCHOR_PROVIDER_URL="https://api.devnet.solana.com"
export ANCHOR_WALLET="$HOME/.config/solana/id.json"

# Build
echo "🔨 Building program..."
anchor build --no-idl

# Check balance
BALANCE=$(solana balance --url devnet | grep -oE "[0-9]+\.[0-9]+")
echo "💰 Current balance: $BALANCE SOL"

if (( $(echo "$BALANCE < 2.0" | bc -l) )); then
  echo "⚠️  WARNING: Balance may be insufficient for deployment (< 2.0 SOL)"
  echo "   Please get more Devnet SOL from: https://faucet.solana.com"
  echo ""
fi

# Deploy
echo "🚀 Deploying program..."
solana program deploy --url devnet \
  --program-id "$LIB_ID_FULL" \
  --keypair "$HOME/.solana/wallets/litterbox-v2-new.json" \
  target/deploy/litterbox_v2.so

echo ""
echo "✅ Deployment successful!"
echo "Program ID: $LIB_ID_FULL"
echo ""
echo "📝 Next step: Initialize the protocol"
echo "   npx ts-node scripts/init-raw.ts"
