# LitterBox v2.0 - Quick Start Guide

## 🚀 5-Minute Setup

### 1. Install Dependencies
```bash
cd /home/jay/.openclaw/workspace/litterbox-v2
yarn install
```

### 2. Build the Program
```bash
anchor build
```
**Note:** Copy the Program ID from the output!

### 3. Update Program ID
Edit these two files with your new Program ID:
- `Anchor.toml` (all 3 occurrences)
- `programs/litterbox-v2/src/lib.rs` (line 7)

### 4. Deploy to Devnet
```bash
anchor deploy --provider.cluster devnet
```

### 5. Create $LITTER Token
```bash
# Create token (6 decimals)
spl-token create-token --decimals 6

# Mint 1 billion tokens
spl-token mint <YOUR_MINT_ADDRESS> 1000000000000000000

# Note: Keep 1% for yourself, transfer 99% later
```

### 6. Initialize Protocol
```bash
# You'll need to write a small script for this
# See DEPLOYMENT_GUIDE.md for full example
```

## 📋 What Each File Does

| File | Purpose |
|------|---------|
| `programs/litterbox-v2/src/lib.rs` | **Main program** - state & instructions |
| `Anchor.toml` | Anchor configuration |
| `Cargo.toml` | Rust dependencies |
| `README.md` | Full documentation |
| `DEPLOYMENT_GUIDE.md` | Step-by-step deploy guide |
| `PROJECT_SUMMARY.md` | Architecture overview |
| `QUICKSTART.md` | This file! |

## 🔧 Common Commands

```bash
# Build
anchor build

# Deploy to Devnet
anchor deploy --provider.cluster devnet

# Deploy to Mainnet (BE CAREFUL!)
anchor deploy --provider.cluster mainnet

# Run tests
anchor test

# Check program logs
solana logs --url devnet <PROGRAM_ID>
```

## 📊 Key Numbers

| Parameter | Value |
|-----------|-------|
| Total Supply | 1 Billion $LITTER |
| Vault % | 99% |
| Platform Fee | 2% |
| Graduation Threshold | 1,000 USDC |
| Virtual Start | 1B $LITTER vs 1,000 USDC |

## ⚠️ Before You Deploy

1. ✅ Have Devnet SOL in your wallet
2. ✅ Created $LITTER token (1B supply)
3. ✅ Noted the Program ID after build
4. ✅ Updated `declare_id!` in lib.rs
5. ✅ Ready to transfer 99% to vault

## 🆘 Troubleshooting

**"Command not found: anchor"**
```bash
# Install Anchor
cargo install --git https://github.com/coral-xyz/anchor avm --tag v0.30.1
avm install 0.30.1
```

**"Program ID mismatch"**
- Rebuild after updating lib.rs
- Make sure Anchor.toml matches

**"Insufficient funds"**
- Get Devnet SOL from faucet
- Transfer 99% of $LITTER to vault

## 📚 Next Steps

1. Read `README.md` for full docs
2. Follow `DEPLOYMENT_GUIDE.md` for deployment
3. Review `PROJECT_SUMMARY.md` for architecture
4. Study `lib.rs` for implementation details

## 🎯 Ready to Test?

```bash
# After deployment, test a small deposit
# (You'll need to write the test script)
```

---

**Questions?** Check the full documentation or review the code in `programs/litterbox-v2/src/lib.rs`
