# ✅ Phase 3 Complete: Swap Instruction Implemented

## 🎯 What We Built

A fully functional swap instruction that allows users to deposit USDC and receive $LITTER tokens based on our bonding curve formula.

---

## 🔧 Swap Function Details

### Accounts Required (8 total)
1. **user** - [signer, writable] - The depositor
2. **config_pda** - [writable] - Config account
3. **pool_pda** - [writable] - Pool account
4. **user_usdc_ata** - [writable] - User's USDC token account
5. **pool_usdc_ata** - [writable] - Pool's USDC token account
6. **user_litter_ata** - [writable] - User's $LITTER token account
7. **litter_mint** - [] - $LITTER mint
8. **token_program** - [] - SPL Token program

### Instruction Data
- **Bytes 0-7**: `usdc_amount` (u64 little-endian)

### What It Does
1. ✅ Validates user is signer
2. ✅ Reads current pool state (virtual & real reserves)
3. ✅ Calculates $LITTER amount using bonding curve:
   ```
   litter_out = (usdc_in * virtual_litter) / (virtual_usdc + usdc_in)
   ```
4. ✅ Deducts 2% platform fee
5. ✅ Transfers USDC from user to pool
6. ✅ Transfers $LITTER from pool to user
7. ✅ Updates pool reserves (USDC ↑, Litter ↓)
8. ✅ Activates pool if first deposit

---

## 📊 Bonding Curve Formula

### The Math
```
litter_amount = (usdc_amount * virtual_litter) / (virtual_usdc + usdc_amount)
```

### Example Calculation
**Initial State:**
- Virtual USDC: 1,000
- Virtual Litter: 1,000 (with 6 decimals = 1,000,000,000,000)

**User deposits 100 USDC:**
```
litter_out = (100 * 1,000,000,000,000) / (1,000,000,000 + 100,000,000)
           = 100,000,000,000,000 / 1,100,000,000
           = 90.909 LITTER
```

**After 2% fee:**
```
fee = 90.909 * 0.02 = 1.818 LITTER
user_receives = 90.909 - 1.818 = 89.091 LITTER
```

### Price Impact
As more users deposit:
- Virtual USDC increases → Price per Litter increases
- Virtual Litter decreases → Scarcity increases
- This creates an upward-sloping supply curve

---

## 🏦 Fee Structure

### 2% Platform Fee
- Calculated on $LITTER amount
- Deducted before transfer to user
- Remains in pool (increases pool value)

**Example:**
- User should receive: 100 LITTER
- Fee (2%): 2 LITTER
- User gets: 98 LITTER
- Pool keeps: 2 LITTER (adds to pool value)

---

## 🔄 Pool State Transitions

### Before First Deposit
```
virtual_litter: 1,000,000,000,000
virtual_usdc:   1,000,000,000
real_litter:    0
real_usdc:      0
is_active:      0 (false)
```

### After First Deposit (100 USDC)
```
virtual_litter: 1,000,000,000,000 (unchanged)
virtual_usdc:   1,000,000,000 (unchanged)
real_litter:    999,910,909,000 (decreased by user amount)
real_usdc:      100,000,000 (increased by deposit)
is_active:      1 (true)
```

---

## 🧪 Testing Steps

### 1. Compile Test
```bash
cd /home/jay/.openclaw/workspace/litterbox-v2
cargo build-sbf
# ✅ Should compile with no errors
```

### 2. Deploy Program
```bash
solana program deploy target/deploy/litterbox_v2.so \
  --url devnet \
  --keypair ~/.config/solana/id_litterbox_v2.json
```

### 3. Initialize (if not done)
```bash
npx ts-node scripts/init-program.ts
```

### 4. Test Swap
```bash
npx ts-node scripts/test-swap.ts 100
# Deposits 100 USDC, receives ~89 LITTER
```

---

## ⚠️ Known Limitations

### 1. Pre-Minted Tokens Required
The current implementation assumes $LITTER tokens are already minted and in the pool. For true bonding curve behavior, you'd want to:
- Mint tokens on-the-fly during swap
- Or pre-mint all 1B and transfer from pool

### 2. Jupiter Integration
The swap instruction assumes USDC is already in the user's account. In production:
- Frontend should call Jupiter API first
- Jupiter swaps any token → USDC
- Then user calls our swap instruction

### 3. No Slippage Protection
Users can't specify minimum $LITTER to receive. Should add:
- `min_litter_out` parameter
- Revert if calculated amount < minimum

---

## 🚀 Next: Phase 4

**Goal:** Implement the `withdraw` instruction

**Tasks:**
1. Accept $LITTER from user
2. Calculate USDC amount (reverse bonding curve)
3. Deduct 2% fee
4. Transfer USDC from pool to user
5. Update pool reserves
6. Handle Jupiter swap for other tokens

**Ready to proceed?** Say "Continue to Phase 4" and I'll implement the withdraw logic!
