# LitterBox v2.0 - Deployment Fixes Summary

## Expert Audit Results (March 24, 2026)

An outside resource identified **4 critical bugs** in our initialization approach:

### Bug #1: Vaults are ATAs, NOT PDAs ❌→✅
**Wrong (original):**
```typescript
const [usdcVaultPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("usdc_vault"), configPda.toBuffer()],
  PROGRAM_ID
);
```

**Correct (fixed):**
```typescript
const usdcVault = getAssociatedTokenAddressSync(usdcMint, configKeypair.publicKey, true);
const litterVault = getAssociatedTokenAddressSync(litterMint, configKeypair.publicKey, true);
```

**Why:** The Rust code uses `associated_token::` constraints, meaning the vaults are Associated Token Accounts owned by the config account, not program PDAs.

### Bug #2: Config & VirtualPool are Keypairs, NOT PDAs ❌→✅
**Wrong (original):**
```typescript
const [configPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("config")],
  PROGRAM_ID
);
```

**Correct (fixed):**
```typescript
const configKeypair = Keypair.generate();
const virtualPoolKeypair = Keypair.generate();
// Then pass as .signers([configKeypair, virtualPoolKeypair])
```

**Why:** The `Initialize` instruction uses `#[account(init, payer = authority, space = ...)]` with NO seeds. These are fresh keypair accounts, not PDAs. Seeds only appear in other instructions like `SweepAndSwap`.

### Bug #3: Discriminator was actually correct ✅
The discriminator `[175, 175, 109, 31, 131, 149, 117, 81]` was correct (sha256("global:initialize")[0..8]).

### Bug #4: Program ID Mismatch ⚠️
Ensure `declare_id!()` in `lib.rs` matches:
- The deployed program address on-chain
- The `PROGRAM_ID` in scripts
- The `Anchor.toml` configuration

## Files Updated

### 1. `scripts/initialize-fixed.js` (and `.ts`)
Complete rewrite with correct account derivation.

### 2. `target/idl/litterbox_v2.json`
Corrected IDL with proper `InitializeParams` type and account structure.

## How to Deploy

### Local Testing (Surfpool)
```bash
cd /home/jay/.openclaw/workspace/litterbox-v2
export ANCHOR_WALLET=/home/jay/.config/solana/id.json
export ANCHOR_PROVIDER_URL="http://127.0.0.1:8899"
export LITTERBOX_PROGRAM_ID="GqJ4yCJVavEMhYfwpb2M9ydrJXeFfi3Sw8zgHo3xK9hR"
export LITTER_MINT="H5RwQLRyBAvVvXbYxzWRYFjXWPjfLtj2dtTPiChRTUK7"
node scripts/initialize-fixed.js
```

### Devnet Deployment
```bash
export ANCHOR_PROVIDER_URL="https://api.devnet.solana.com"
export LITTERBOX_PROGRAM_ID="8LhTE9owPwbdJMHbE7Nwi9i2H66JsPHzjwWbKPgLUa7t"
export LITTER_MINT="<your-litter-mint>"
node scripts/initialize-fixed.js
```

## Next Steps

1. ✅ Program compiled and deployed to local Surfpool
2. ✅ Expert fixes implemented in `initialize-fixed.js`
3. ⏳ Test initialization on local Surfpool
4. ⏳ Deploy to Devnet with matching Program ID
5. ⏳ Test full flow: deposit → sweep → graduate → flush

## Protocol State

After successful initialization, `protocol-state.json` will contain:
- `config`: Public key of the config account (generated keypair)
- `virtualPool`: Public key of the virtual pool account (generated keypair)
- `usdcVault`: ATA for USDC (derived from config)
- `litterVault`: ATA for LITTER (derived from config)
- Secret keys for config and virtualPool (save these!)

**IMPORTANT:** Unlike PDA-based designs, these accounts are unique keypairs that cannot be re-derived. You MUST save the `protocol-state.json` file.
