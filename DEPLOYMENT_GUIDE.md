# LitterBox v2.0 Deployment Guide

## Prerequisites
- [x] Anchor 0.30.1+ installed
- [x] Solana CLI installed and configured
- [x] Node.js + Yarn installed
- [x] Devnet SOL in your wallet

## Step 1: Create $LITTER Token

Before deploying the program, create the SPL token:

```bash
# Create token with 6 decimals
spl-token create-token --decimals 6

# Mint 1 billion tokens (1,000,000,000 * 10^6)
spl-token mint <MINT_ADDRESS> 1000000000000000000

# Verify supply
spl-token supply <MINT_ADDRESS>
```

**Important:** Note the mint address - you'll need it for initialization.

## Step 2: Build the Program

```bash
cd /home/jay/.openclaw/workspace/litterbox-v2

# Install dependencies
yarn install

# Build the program
anchor build
```

After building, you'll get a **new Program ID**. Update these files:
1. `Anchor.toml` - Replace the placeholder ID
2. `programs/litterbox-v2/src/lib.rs` - Update `declare_id!`

## Step 3: Deploy to Devnet

```bash
# Deploy
anchor deploy --provider.cluster devnet

# Note the Program ID from output
```

## Step 4: Initialize the Protocol

Create an initialization script or use anchor run:

```typescript
// scripts/initialize.ts
import * as anchor from "@coral-xyz/anchor";
import { LitterboxV2 } from "../target/types/litterbox_v2";

export default async function initializeProgram() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.LitterboxV2 as anchor.Program<LitterboxV2>;

  // Derive PDAs
  const [configPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program.programId
  );

  const [virtualPoolPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("virtual_pool")],
    program.programId
  );

  const [vaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), configPda.toBytes()],
    program.programId
  );

  // Initialize
  const tx = await program.methods
    .initialize({
      graduationThreshold: new anchor.BN(1000000000), // 1000 USDC (6 decimals)
      virtualInitialUsdc: new anchor.BN(1000000000), // 1000 USDC
      virtualInitialLitter: new anchor.BN(1000000000000), // 1B $LITTER
    })
    .accounts({
      config: configPda,
      virtualPool: virtualPoolPda,
      vault: vaultPda,
      litterMint: LITTER_MINT_ADDRESS,
      usdcMint: USDC_MINT_ADDRESS,
      authority: provider.publicKey,
    })
    .rpc();

  console.log("✅ Initialized:", tx);
}
```

## Step 5: Fund the Vault

Transfer 99% of $LITTER supply to the vault PDA:

```bash
# Calculate 99% of 1B tokens
spl-token transfer <LITTER_MINT> 990000000000000 <VAULT_PDA>
```

## Step 6: Verify Deployment

```bash
# Check config account
anchor run verify-config

# Check virtual pool
anchor run verify-pool
```

## Step 7: Test Deposit

```bash
# Test with small amount
anchor run deposit-test --amount 10000000 # 10 USDC
```

## Troubleshooting

### "Program ID mismatch"
- Ensure `declare_id!` in lib.rs matches deployed ID
- Rebuild after updating ID

### "Insufficient funds"
- Make sure vault has 99% of supply
- Verify USDC mint address is correct

### "Graduation threshold not met"
- Need to accumulate more deposits
- Check `accumulated_usdc` in virtual pool

## Next Steps

1. **Test thoroughly on Devnet**
2. **Audit the code** before mainnet
3. **Add Jupiter CPI** for real token swaps
4. **Add Raydium CPI** for graduation
5. **Deploy to Mainnet**

## Support

For issues, check:
- Anchor logs: `export RUST_LOG=debug`
- Solana Explorer for transaction details
- Program logs on Solana FM
