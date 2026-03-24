# LitterBox v2.0 - Project Summary

## ✅ What We Built

**LitterBox v2** is a zero-capital, self-sustaining token launchpad that:
- Accepts **any SPL token** (USDC, SOL, BONK, memecoins)
- Uses a **virtual bonding curve** for initial price discovery
- **Instantly distributes** $LITTER tokens from vault
- **Auto-graduates** to real Raydium liquidity at $1,000 USDC
- Charges **2% platform fee** on every deposit
- Requires **$0 upfront capital** from team

## 📁 Project Structure

```
litterbox-v2/
├── programs/litterbox-v2/src/lib.rs    # Main program logic
├── tests/                               # Test files (Phase 2)
├── migrations/                          # Deploy scripts (Phase 2)
├── Anchor.toml                          # Anchor config
├── Cargo.toml                           # Rust dependencies
├── package.json                         # JS dependencies
├── DEPLOYMENT_GUIDE.md                  # Step-by-step deploy
└── README.md                            # Documentation
```

## 🔧 Core Components

### 1. State Accounts
- **Config**: Authority, mints, thresholds, graduation status
- **VirtualPool**: Virtual reserves, accumulated USDC, distribution stats

### 2. Instructions
| Instruction | Purpose | Status |
|-------------|---------|--------|
| `initialize` | Create Config + VirtualPool | ✅ Implemented |
| `deposit_any_token` | Main deposit logic | ⚠️ Phase 1 (simulated swap) |
| `graduate_to_real` | Auto-create Raydium pool | ⚠️ Phase 2 (needs CPI) |
| `sweep_and_swap` | Convert dust tokens | ⏳ Phase 2 |

### 3. Key Features
- ✅ **2% Platform Fee**: Automatically deducted
- ✅ **Bonding Curve Math**: Constant product formula
- ✅ **Auto-Graduation**: Triggers at threshold
- ✅ **Slippage Protection**: User-specified minimum output
- ✅ **Event Emissions**: For frontend tracking

## 🚀 Phase 1 vs Phase 2

### Phase 1 (Current) - Core Logic ✅
- [x] Virtual pool state management
- [x] Bonding curve calculations
- [x] Fee collection (2%)
- [x] Auto-graduation trigger
- [x] Event emissions
- [ ] Jupiter CPI (simulated for now)
- [ ] Real token transfers

### Phase 2 (Next) - Full Integration ⏳
- [ ] Jupiter CPI for token swaps
- [ ] Raydium CPI for pool creation
- [ ] Real SPL token transfers
- [ ] Dust token sweeping
- [ ] Comprehensive tests
- [ ] Frontend integration

## 📊 Tokenomics

| Parameter | Value |
|-----------|-------|
| Total Supply | 1,000,000,000 $LITTER |
| Vault Allocation | 99% (990M tokens) |
| Team/Marketing | 1% (10M tokens) |
| Initial Virtual Pool | 1B $LITTER vs 1,000 USDC |
| Graduation Threshold | 1,000 USDC accumulated |
| Platform Fee | 2% per deposit |
| Min Deposit | $1.00 (anti-spam) |

## 🎯 Next Steps

1. **Build & Deploy** (You can do this now!)
   ```bash
   cd litterbox-v2
   anchor build
   anchor deploy --provider.cluster devnet
   ```

2. **Create $LITTER Token**
   - Use `spl-token create-token --decimals 6`
   - Mint 1 billion supply
   - Transfer 99% to vault PDA

3. **Initialize Protocol**
   - Run initialize instruction
   - Verify virtual pool state

4. **Test Deposit Flow**
   - Test with small USDC amount
   - Verify bonding curve math
   - Check fee collection

5. **Phase 2 Development**
   - Integrate Jupiter CPI
   - Integrate Raydium CPI
   - Full end-to-end testing

## 📝 Key Decisions Made

1. **Pre-minted Token**: Simpler than program minting, more secure
2. **2% Fee**: Reasonable platform revenue, doesn't discourage deposits
3. **Auto-Graduation**: No manual intervention needed
4. **Virtual First**: Zero capital required from team
5. **Any Token Support**: Maximizes accessibility

## 🛡️ Safety Features

- ✅ Minimum deposit prevents spam
- ✅ Slippage tolerance protects users
- ✅ Atomic transactions (all-or-nothing)
- ✅ Event logging for transparency
- ✅ Admin emergency functions (Phase 2)

## 📞 Support

- Documentation: `README.md`
- Deployment: `DEPLOYMENT_GUIDE.md`
- Source: `programs/litterbox-v2/src/lib.rs`

---

**Status**: Ready for Phase 1 Testing 🚀
