# LitterBox v2.0 - Auto-LP Launchpad

## Overview
LitterBox v2 is a **zero-capital, self-sustaining launchpad** that accepts **any SPL token** and automatically creates real liquidity on Raydium.

### Key Features
- ✅ **Virtual Pool First**: Starts with simulated liquidity, no upfront capital needed
- ✅ **Any Token Deposits**: Accept USDC, SOL, BONK, memecoins - anything!
- ✅ **Instant Distribution**: Users get $LITTER immediately from vault
- ✅ **2% Platform Fee**: Automatically deducted from each deposit
- ✅ **Auto-Graduation**: When $1,000 USDC accumulated, auto-creates real Raydium pool
- ✅ **User Pays Gas**: Platform never fronts capital for swaps

### Architecture
```
User deposits ANY token
       ↓
Jupiter swaps to USDC (user pays fees)
       ↓
2% fee deducted, 98% to virtual pool
       ↓
Bonding curve calculates $LITTER amount
       ↓
$LITTER sent from Vault → User (instant)
       ↓
USDC accumulates in virtual pool
       ↓
Threshold reached ($1,000)
       ↓
AUTO-GRADUATE: Create real Raydium pool
       ↓
Continue with real liquidity
```

## Getting Started

### Prerequisites
- Anchor 0.30.1+
- Solana CLI
- Node.js + Yarn

### Installation
```bash
cd litterbox-v2
yarn install
anchor build
```

### Deploy to Devnet
```bash
anchor deploy --provider.cluster devnet
```

### Initialize Protocol
```bash
# Create $LITTER token first (1B supply)
# Transfer 99% to vault PDA

anchor run initialize \
  --graduation-threshold 1000000000 \
  --virtual-initial-usdc 1000000000 \
  --virtual-initial-litter 1000000000000
```

## Configuration

### Constants
| Parameter | Value | Description |
|-----------|-------|-------------|
| TOTAL_SUPPLY | 1,000,000,000 | 1 Billion $LITTER |
| VAULT_ALLOCATION | 99% | Percentage in program vault |
| VIRTUAL_INITIAL_USDC | 1,000 | Initial virtual depth |
| VIRTUAL_INITIAL_LITTER | 1,000,000,000 | All supply virtual |
| GRADUATION_THRESHOLD | 1,000 USDC | When to create real pool |
| PLATFORM_FEE | 2% | Fee on deposits |
| MIN_DEPOSIT | $1.00 | Anti-spam minimum |

### Bonding Curve Formula
```
litter_out = (virtual_litter_reserve * value_in) / (virtual_usdc_reserve + value_in)
```

## Instructions

### 1. `initialize`
Sets up Config and VirtualPool accounts.

### 2. `deposit_any_token`
Main entry point. Accepts any SPL token, swaps to USDC, distributes $LITTER.

### 3. `graduate_to_real`
Manual override for graduation (admin only).

### 4. `sweep_and_swap`
Converts accumulated dust tokens to USDC (permissionless).

## Testing
```bash
anchor test
```

## Deployment Checklist
- [ ] Create $LITTER SPL token (1B supply)
- [ ] Mint 100% to admin wallet
- [ ] Deploy program
- [ ] Initialize protocol
- [ ] Transfer 99% of supply to vault PDA
- [ ] Verify virtual pool state
- [ ] Test deposit with small amount
- [ ] Monitor graduation progress

## License
Apache 2.0
