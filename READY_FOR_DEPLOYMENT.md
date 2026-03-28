# 🚀 LitterBox v2.0 - Ready for Deployment

**Status:** ✅ All fixes implemented, ready for Devnet deployment
**Date:** 2026-03-25
**Program ID:** `GqJ4yCJVavEMhYfwpb2M9ydrJXeFfi3Sw8zgHo3xK9hR`

---

## Quick Start (Copy/Paste Commands)

```bash
# Navigate to project
cd /home/jay/.openclaw/workspace/litterbox-v2

# Step 1: Deploy to Devnet
anchor deploy --provider.cluster devnet

# Step 2: Initialize protocol
export LITTER_MINT="H5RwQLRyBAvVvXbYxzWRYFjXWPjfLtj2dtTPiChRTUK7"
export LITTERBOX_PROGRAM_ID="GqJ4yCJVavEMhYfwpb2M9ydrJXeFfi3Sw8zgHo3xK9hR"
node init-devnet.js

# Step 3: Verify success
cat protocol-state.json
```

---

## What Was Fixed (5 Critical Bugs)

### ❌ Bug #1: Wrong Discriminator
- **Was:** `[175, 175, 109, 31, 131, 149, 117, 81]`
- **Now:** `[175, 175, 109, 31, 13, 152, 155, 237]` (correct SHA256 hash)

### ❌ Bug #2: Config as PDA
- **Was:** `PublicKey.findProgramAddressSync([b"config"], PROGRAM_ID)`
- **Now:** `Keypair.generate()` (fresh keypair, no seeds)

### ❌ Bug #3: VirtualPool as PDA
- **Was:** `PublicKey.findProgramAddressSync([b"virtual_pool"], PROGRAM_ID)`
- **Now:** `Keypair.generate()` (fresh keypair, no seeds)

### ❌ Bug #4: Vaults as Program PDAs
- **Was:** `findProgramAddressSync(["usdc_vault", ...], PROGRAM_ID)`
- **Now:** `getAssociatedTokenAddressSync(usdcMint, configKeypair.publicKey, true)`

### ❌ Bug #5: Anchor 0.32 IDL Format
- **Was:** Old format with `metadata.address`
- **Now:** Root `address` field, snake_case keys

---

## Files You Need

| File | Purpose | Use It? |
|------|---------|---------|
| `init-devnet.js` | **Definitive init script** | ✅ YES |
| `target/idl/litterbox_v2.json` | Corrected IDL | ✅ (auto-used) |
| `programs/litterbox-v2/src/lib.rs` | Rust program | ✅ (already fixed) |
| `scripts/initialize-fixed.js` | Earlier attempt | ❌ No (superseded) |
| `scripts/initialize-fixed.ts` | TS version | ❌ No (superseded) |
| `init-raw.ts` | Broken original | ❌ NO |
| `tests/initialize.ts` | Broken test | ❌ NO |

---

## Expected Output

When `init-devnet.js` succeeds, you'll see:

```
🚀 LitterBox v2.0 - Devnet Initialization
──────────────────────────────────────────
Program ID : 8LhTE9owPwbdJMHbE7Nwi9i2H66JsPHzjwWbKPgLUa7t
LITTER Mint : H5RwQLRyBAvVvXbYxzWRYFjXWPjfLtj2dtTPiChRTUK7
USDC Mint : 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU

RPC : https://api.devnet.solana.com
Authority : 9y2YgLd4x5rB4yKDj4nipzGPRYjtBfGmRs28LTX73cf7
Balance : 1.2345 SOL

📝 Generated accounts (SAVE THESE):
  config      : <generated-address>
  virtualPool : <generated-address>

🏦 Vault addresses (ATAs of config):
  usdcVault  : <derived-ata>
  litterVault: <derived-ata>

📡 Sending transaction...

✅ Protocol initialized successfully!
TX  : https://explorer.solana.com/tx/<signature>?cluster=devnet
Scan: https://solscan.io/tx/<signature>?cluster=devnet

💾 State saved to: protocol-state.json
  Keep this file - config and virtualPool addresses are
  NOT derivable from seeds. You must reference them directly.
```

---

## What's in protocol-state.json

```json
{
  "programId": "8LhTE9owPwbdJMHbE7Nwi9i2H66JsPHzjwWbKPgLUa7t",
  "config": "<generated-keypair-address>",
  "virtualPool": "<generated-keypair-address>",
  "usdcVault": "<derived-ata>",
  "litterVault": "<derived-ata>",
  "litterMint": "H5RwQLRyBAvVvXbYxzWRYFjXWPjfLtj2dtTPiChRTUK7",
  "usdcMint": "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
  "authority": "<your-wallet>",
  "txSignature": "<transaction-signature>",
  "_configSecretKey": [...],
  "_virtualPoolSecretKey": [...]
}
```

**⚠️ CRITICAL:** The secret keys are required to reference these accounts in future transactions. Back them up!

---

## Troubleshooting

### "Balance too low"
```bash
solana airdrop 2 --url devnet
```

### "Transaction failed: Custom program error"
Check the program logs in the error output. Common issues:
- Wrong discriminator → Ensure using `init-devnet.js`
- Account mismatch → Verify vaults are ATAs, not PDAs
- Missing signer → Ensure all 3 keypairs sign

### "Program not deployed"
```bash
anchor deploy --provider.cluster devnet
```

---

## Next Steps After Init

1. ✅ Initialize protocol (this session)
2. ⏳ Test `depositAnyToken` instruction
3. ⏳ Test `sweepAndSwap` instruction
4. ⏳ Test `graduateToReal` instruction (after hitting USDC threshold)
5. ⏳ Test `flushToLp` instruction

---

## Contact & Resources

- **GitHub:** https://github.com/uplinkedassitant/litterbox-v2
- **Program ID:** `8LhTE9owPwbdJMHbE7Nwi9i2H66JsPHzjwWbKPgLUa7t`
- **Token:** $LITTER (9 decimals, 1B supply)
- **Mint:** `H5RwQLRyBAvVvXbYxzWRYFjXWPjfLtj2dtTPiChRTUK7`

---

**🎯 Bottom Line:** All 5 critical bugs are fixed. Run the commands above to deploy.
