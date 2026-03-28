# LitterBox v2 🐱‍👤

**Jupiter-Powered Bonding Curve Platform**

Turn any token (including memecoins) into $LITTER via a decentralized bonding curve.

## 🎯 Features

- **Jupiter Integration**: Swap ANY token Jupiter supports
- **Bonding Curve Pricing**: Fair, algorithmic pricing
- **2% Platform Fee**: Sustainable revenue model
- **Pre-Minted Supply**: 1B $LITTER tokens (no minting during swaps)
- **Single Pool Model**: Simple, efficient liquidity

## 📊 Tokenomics

- **Total Supply**: 1,000,000,000 $LITTER
- **Distribution**:
  - 97% → Liquidity Pool (Bonding Curve)
  - 3% → Reserves

## 🏗️ Architecture

```
User Token (via Jupiter) → USDC → Pool → $LITTER → User
                              ↑
                        2% Fee to Treasury
```

## Program ID

**Devnet**: `CyuzmNggCxLyupt8JBdMdisRn5yo1eUfBPne9BqTnt85`

## Instructions

1. **Initialize**: Create Config, Pool, and mint 1B $LITTER
2. **Swap**: Deposit any token → Receive $LITTER
3. **Withdraw**: Burn $LITTER → Receive any token

## Development

```bash
# Build
cd program
cargo build-sbf

# Deploy
solana program deploy target/deploy/litterbox_v2.so \
  --url devnet \
  --keypair ~/.config/solana/id_litterbox_v2.json
```

## License

MIT
