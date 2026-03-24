# Implementation Notes - LitterBox v2.0

## What Was Built

This document explains the implementation decisions and current state of the LitterBox v2 program.

## Architecture Decisions

### 1. Pre-Minted Token (vs Dynamic Minting)
**Decision:** Pre-mint 1 billion $LITTER, transfer 99% to vault  
**Why:** 
- Simpler code (no mint authority management)
- More secure (can't accidentally mint more)
- Transparent (supply is fixed and visible)
- Standard practice for SPL tokens

### 2. Virtual Pool First
**Decision:** Start with virtual liquidity, graduate to real  
**Why:**
- Zero capital required from team
- Fair price discovery from the start
- Automatic transition to real liquidity
- Prevents rug pulls (team can't pull liquidity)

### 3. Bonding Curve Formula
**Formula:** `litter_out = (virtual_litter * value_in) / (virtual_usdc + value_in)`  
**Why Constant Product:**
- Simple and predictable
- Same formula as AMMs (Raydium, Orca)
- Smooth price curve
- No complex oracle needed initially

### 4. 2% Platform Fee
**Decision:** Charge 2% on every deposit  
**Why:**
- Sustainable revenue for protocol
- Low enough to not discourage deposits
- Automatically accumulated in USDC
- Used for graduation (buying back liquidity)

### 5. Auto-Graduation
**Decision:** Trigger graduation automatically at threshold  
**Why:**
- No manual intervention needed
- Prevents admin key risks
- Transparent and predictable
- Community can trust the code

## Current Implementation Status

### ✅ Completed (Phase 1)
- [x] State structs (Config, VirtualPool)
- [x] Initialize instruction
- [x] Deposit instruction (core logic)
- [x] Bonding curve math
- [x] Fee calculation (2%)
- [x] Auto-graduation trigger
- [x] Event emissions
- [x] Error handling
- [x] Documentation

### ⚠️ Simulated (Needs Phase 2)
- [ ] Jupiter CPI (currently placeholder)
- [ ] Real token transfers (currently simulated)
- [ ] Raydium pool creation (placeholder)
- [ ] Dust token sweeping (not implemented)
- [ ] Comprehensive tests (need to write)

### 📝 Code Structure

```
lib.rs
├── Program Module
│   ├── initialize()        ✅ Complete
│   ├── deposit_any_token() ⚠️ Simulated swap
│   └── graduate_to_real()  ⚠️ Placeholder
│
├── State Accounts
│   ├── Config              ✅ Complete
│   └── VirtualPool         ✅ Complete
│
├── Contexts
│   ├── Initialize          ✅ Complete
│   ├── DepositAnyToken     ✅ Complete
│   └── GraduateToReal      ✅ Complete
│
├── Error Codes             ✅ Complete
├── Events                  ✅ Complete
└── Constants               ✅ Complete
```

## Key Functions Explained

### `initialize()`
Creates the Config and VirtualPool accounts. Sets initial virtual reserves.

**What it does:**
1. Creates Config account with authority, mints, thresholds
2. Creates VirtualPool with initial virtual reserves
3. Creates Vault PDA for holding $LITTER
4. Emits `ProtocolInitialized` event

**Inputs:**
- `graduation_threshold`: When to graduate (e.g., 1000 USDC)
- `virtual_initial_usdc`: Starting virtual USDC (e.g., 1000)
- `virtual_initial_litter`: Starting virtual $LITTER (e.g., 1B)

### `deposit_any_token()`
Main instruction. Handles any SPL token deposit.

**Flow:**
1. Validate amount > 0
2. Transfer user's token to program (Phase 2: Jupiter swap)
3. Calculate 2% fee
4. Calculate $LITTER output (bonding curve)
5. Check slippage tolerance
6. Transfer $LITTER from vault to user
7. Update virtual pool state
8. Check auto-graduation
9. Emit events

**Current Limitations:**
- Assumes 1:1 swap (no real Jupiter integration)
- Doesn't actually transfer tokens yet
- Fee calculation is correct but not collected

### `graduate_to_real()`
Transitions from virtual to real pool.

**What it should do (Phase 2):**
1. Verify threshold met
2. Take accumulated USDC
3. Take matching $LITTER from vault
4. Create Raydium pool via CPI
5. Lock LP tokens
6. Update state to Real mode

**Current status:** Placeholder only

## Mathematical Formulas

### Bonding Curve (Constant Product)
```
k = virtual_usdc_reserve * virtual_litter_reserve

litter_out = (virtual_litter_reserve * usdc_in) / (virtual_usdc_reserve + usdc_in)

new_virtual_usdc = virtual_usdc_reserve + usdc_in
new_virtual_litter = virtual_litter_reserve - litter_out
```

### Fee Calculation
```
fee_amount = usdc_received * 0.02  (2%)
value_after_fee = usdc_received - fee_amount
```

### Price Impact
```
price_before = virtual_usdc / virtual_litter
price_after = (virtual_usdc + usdc_in) / (virtual_litter - litter_out)
impact = (price_after - price_before) / price_before
```

## Security Considerations

### ✅ What's Secure
- Pre-minted token (no mint authority risks)
- Fixed supply (can't inflate)
- Atomic transactions (all-or-nothing)
- Slippage protection for users
- Minimum deposit prevents spam

### ⚠️ What Needs Attention
- Jupiter CPI integration (must validate routes)
- Raydium CPI (must verify pool creation)
- Emergency withdrawal (admin escape hatch)
- Pause mechanism (circuit breaker)

### 🔒 Recommended for Production
1. Multi-sig authority
2. Timelock on upgrades
3. Audit before mainnet
4. Bug bounty program
5. Gradual rollout

## Testing Strategy

### Unit Tests (To Write)
- [ ] Initialize creates correct state
- [ ] Deposit calculates correct output
- [ ] Fee is exactly 2%
- [ ] Slippage check works
- [ ] Auto-graduation triggers
- [ ] Error cases handled

### Integration Tests (To Write)
- [ ] Full deposit flow
- [ ] Multiple deposits update state
- [ ] Graduation creates pool
- [ ] Events emitted correctly

### Test Scenarios
1. Small deposit ($1)
2. Large deposit ($10,000)
3. Exactly at threshold
4. Multiple users depositing
5. Slippage failure case

## Phase 2 TODO List

### High Priority
- [ ] Integrate Jupiter V6 CPI
- [ ] Implement real token transfers
- [ ] Add Raydium pool creation
- [ ] Write comprehensive tests
- [ ] Add emergency functions

### Medium Priority
- [ ] Dust token sweeping
- [ ] Better error messages
- [ ] More events for tracking
- [ ] Admin pause function
- [ ] Fee withdrawal mechanism

### Nice to Have
- [ ] Multiple graduation thresholds
- [ ] Configurable fee percentage
- [ ] Staking rewards
- [ ] Governance integration

## Deployment Checklist

### Pre-Deployment
- [ ] Create $LITTER token
- [ ] Mint 1B supply
- [ ] Build program
- [ ] Update Program ID
- [ ] Test on localnet

### Deployment
- [ ] Deploy to Devnet
- [ ] Initialize protocol
- [ ] Transfer 99% to vault
- [ ] Verify state
- [ ] Test small deposit

### Post-Deployment
- [ ] Monitor events
- [ ] Check bonding curve
- [ ] Verify fee collection
- [ ] Test graduation (if threshold reached)
- [ ] Document any issues

## Resources

- **Solana Program Library:** https://github.com/solana-labs/solana-program-library
- **Anchor Documentation:** https://www.anchor-lang.com/
- **Jupiter API:** https://station.jup.ag/docs
- **Raydium SDK:** https://github.com/raydium-io/raydium-sdk

---

**Status:** Phase 1 Complete ✅ | Phase 2 Planning 📋

**Next Action:** Build and deploy to Devnet for testing
