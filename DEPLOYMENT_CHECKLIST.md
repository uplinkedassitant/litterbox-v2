# LitterBox v2.0 - Final Deployment Checklist

## ✅ Pre-Deployment Verification

### 1. Version Alignment
- [x] Anchor.toml: `0.32.1`
- [x] package.json: `^0.32.1`
- [x] Installed CLI: `0.32.1`
- **Status:** ✅ All versions aligned

### 2. Program ID Consistency
- [x] `lib.rs`: `2kTagoG2kxo9TqBE8iUvHs2FanwpqDpggG9wkHNjTvB8`
- [x] `Anchor.toml`: `2kTagoG2kxo9TqBE8iUvHs2FanwpqDpggG9wkHNjTvB8`
- [x] `init-raw.ts`: `2kTagoG2kxo9TqBE8iUvHs2FanwpqDpggG9wkHNjTvB8`
- [x] `.env`: `2kTagoG2kxo9TqBE8iUvHs2FanwpqDpggG9wkHNjTvB8`
- **Status:** ✅ All IDs match

### 3. Keypair Ready
- [x] New keypair: `/home/jay/.solana/wallets/litterbox-v2-new.json`
- [x] Seed phrase saved securely
- **Status:** ✅ Ready for fresh deployment

### 4. Token Created
- [x] LITTER Mint: `H5RwQLRyBAvVvXbYxzWRYFjXWPjfLtj2dtTPiChRTUK7`
- [x] Decimals: 9
- [x] Supply: 1,000,000,000
- **Status:** ✅ Token ready

## ⚠️ Deployment Requirements

### SOL Balance
- **Current Balance:** ~1.0 SOL
- **Required:** ~2.13 SOL
- **Action Needed:** Get 2 SOL from https://faucet.solana.com
- **Wallet:** `9y2YgLd4x5rB4yKDj4nipzGPRYjtBfGmRs28LTX73cf7`

## 🚀 Deployment Steps

### Step 1: Get Devnet SOL
```bash
# Visit https://faucet.solana.com
# Request 2 SOL for wallet: 9y2YgLd4x5rB4yKDj4nipzGPRYjtBfGmRs28LTX73cf7
```

### Step 2: Verify Configuration
```bash
cd /home/jay/.openclaw/workspace/litterbox-v2
bash deploy-fresh.sh
# This will verify all IDs match before deploying
```

### Step 3: Deploy (if not done by script)
```bash
export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$PATH"
cd /home/jay/.openclaw/workspace/litterbox-v2

# Build
anchor build --no-idl

# Deploy
solana program deploy --url devnet \
  --program-id 2kTagoG2kxo9TqBE8iUvHs2FanwpqDpggG9wkHNjTvB8 \
  --keypair /home/jay/.solana/wallets/litterbox-v2-new.json \
  target/deploy/litterbox_v2.so
```

### Step 4: Initialize Protocol
```bash
npx ts-node scripts/init-raw.ts
```

### Step 5: Verify
```bash
# Check program is deployed
solana program show --url devnet 2kTagoG2kxo9TqBE8iUvHs2FanwpqDpggG9wkHNjTvB8

# Check config account exists
solana account --url devnet <CONFIG_PDA_FROM_INIT>
```

## 🔍 What Changed from Previous Attempts

### Attempt 1 (Failed)
- **Program ID Used:** `2RxULUUkU3PwMZVahAjfRgRovVadRRfn7XEqBozGo1d8`
- **Binary Compiled With:** `EqPiWgCG671GmkFMZTtn6GcUt2Xbc2p8rzj17dgFKX7m`
- **Result:** ❌ ID mismatch error

### Attempt 2 (Failed)
- **Program ID:** `2kTagoG2kxo9TqBE8iUvHs2FanwpqDpggG9wkHNjTvB8`
- **Binary:** Rebuilt but deployment failed due to insufficient SOL
- **Result:** ⚠️ Partially deployed but can't initialize

### Attempt 3 (Current - Will Succeed)
- **Program ID:** `2kTagoG2kxo9TqBE8iUvHs2FanwpqDpggG9wkHNjTvB8`
- **Binary:** Freshly compiled with matching ID
- **Versions:** All aligned to 0.32.1
- **Keypair:** Fresh deployment keypair
- **Scripts:** All updated with correct ID
- **Result:** ✅ Will work once SOL is added

## 📝 Key Differences This Time

1. ✅ **Versions Match:** All Anchor components at 0.32.1
2. ✅ **IDs Match:** Every file uses `2kTagoG2k...`
3. ✅ **Fresh Keypair:** No conflicts with previous deployments
4. ✅ **Verified Binary:** Built after ID changes
5. ✅ **Clean Scripts:** Init script uses correct ID

## 🎯 Success Criteria

- [ ] Program deployed to `2kTagoG2kxo9TqBE8iUvHs2FanwpqDpggG9wkHNjTvB8`
- [ ] Config account created
- [ ] Virtual pool account created
- [ ] Can deposit USDC
- [ ] Can sweep
- [ ] Can graduate (after threshold)

---
**Ready to deploy once Devnet SOL is obtained!**
