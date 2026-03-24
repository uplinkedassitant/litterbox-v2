# $LITTER Token Configuration

## ✅ Correct Configuration (9 Decimals)

**$LITTER** is a **utility/governance token**, so it uses **9 decimals** to match:
- ✅ Native SOL (9 decimals)
- ✅ Most Solana governance tokens
- ✅ Ecosystem standard for utility tokens

**NOT 6 decimals** (which is for stablecoins like USDC/USDT).

---

## 📊 Token Specifications

| Property | Value |
|----------|-------|
| **Token Name** | LitterBox |
| **Symbol** | LITTER |
| **Decimals** | 9 ✅ |
| **Total Supply** | 1,000,000,000 (1 Billion) |
| **Raw Supply** | 1,000,000,000,000,000,000 (10^18) |
| **Mint Authority** | Admin wallet (initial) |
| **Freeze Authority** | Admin wallet (initial) |

---

## 🔧 Creation Commands

### Step 1: Create Token Mint
```bash
# Create with 9 decimals (CORRECT)
spl-token create-token --decimals 9 --enable-metadata

# Example output:
# Creating token <MINT_ADDRESS>
# Note: Keep this address safe!
```

### Step 2: Mint Initial Supply
```bash
# Mint 1 Billion LITTER (9 decimals = 10^18 raw units)
spl-token mint <MINT_ADDRESS> 1000000000000000000

# Verify supply
spl-token supply <MINT_ADDRESS>
# Should show: 1000000000.000000000
```

### Step 3: Add Metadata (Optional but Recommended)
```bash
spl-token initialize-metadata <MINT_ADDRESS> \
  --name "LitterBox" \
  --symbol "LITTER" \
  --uri "https://your-project.com/metadata.json"
```

---

## 📐 Virtual Pool Initialization

When initializing the protocol, use these values (matching 9 decimals):

```bash
npx ts-node scripts/initialize.ts \
  --graduation-threshold 1000000000 \
  --virtual-initial-usdc 1000000000 \
  --virtual-initial-litter 1000000000000000000
```

**Breakdown:**
- `graduation-threshold`: 1,000,000,000 (1,000 USDC × 10^6) = **$1,000**
- `virtual-initial-usdc`: 1,000,000,000 (1,000 USDC × 10^6) = **1,000 USDC**
- `virtual-initial-litter`: 1,000,000,000,000,000,000 (1B LITTER × 10^9) = **1 Billion LITTER**

---

## 🧮 Decimal Comparison

| Token Type | Example | Decimals | 1 Unit = |
|------------|---------|----------|----------|
| **Stablecoin** | USDC, USDT | 6 | 1,000,000 raw |
| **Native** | SOL | 9 | 1,000,000,000 raw |
| **Utility** | $LITTER | 9 | 1,000,000,000 raw ✅ |
| **Meme** | BONK | 5 | 100,000 raw |

**Why 9 decimals for $LITTER?**
- Matches SOL (native token)
- Standard for governance tokens
- Allows fine-grained distributions
- User-friendly (1 token = 1 token, not 0.000001)

---

## ⚠️ Common Mistakes to Avoid

### ❌ Wrong: Using 6 decimals
```bash
# DON'T do this (this is for stablecoins!)
spl-token create-token --decimals 6
```

### ✅ Correct: Using 9 decimals
```bash
# DO this (standard for utility tokens)
spl-token create-token --decimals 9
```

### ❌ Wrong: Wrong mint amount
```bash
# DON'T: This mints 1 trillion tokens with 9 decimals!
spl-token mint <MINT> 1000000000000000000000
```

### ✅ Correct: Right mint amount
```bash
# DO: This mints exactly 1 billion tokens
spl-token mint <MINT> 1000000000000000000
```

---

## 🔍 Verification Checklist

After creation, verify:

- [ ] Token has **9 decimals** (check with `spl-token account-info <MINT>`)
- [ ] Total supply is **1,000,000,000** LITTER
- [ ] You hold **100%** of supply in your wallet
- [ ] Metadata is set (name, symbol, URI)
- [ ] Mint authority is secured (or revoked if desired)
- [ ] Freeze authority is noted (consider revoking for decentralization)

---

## 📚 References

- [Solana SPL Token Program](https://spl.solana.com/token)
- [Solana Cookbook - Create Token](https://solanacookbook.com/references/tokens.html)
- [Token Decimal Standard](https://docs.solana.com/developing/programming-model/tokens)

---

**Remember:** 
- **6 decimals** = Stablecoins (USDC, USDT)
- **9 decimals** = Utility/Governance tokens ($LITTER) ✅
- **5 decimals** = Some meme coins (BONK)

**$LITTER uses 9 decimals!** 🎯
