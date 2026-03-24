# 🎨 Frontend Testing Guide for LitterBox v2.0

## ✅ You Already Have a Frontend!

Great news! The **`auto-lp-launchpad-design`** folder contains a **complete React frontend** with all necessary components:

### Existing Components:
- ✅ `DepositPanel.tsx` - Deposit any token
- ✅ `GraduationPanel.tsx` - Trigger graduation
- ✅ `PoolStatus.tsx` - View pool status
- ✅ `TokenInfo.tsx` - Token information display
- ✅ `Header.tsx` - Navigation
- ✅ Custom hooks (`useProtocol.ts`)
- ✅ Context providers
- ✅ Utility functions

---

## 🚀 Quick Start: Frontend Testing

### Option 1: Use Existing Frontend (Recommended - Fastest)

#### Step 1: Install Dependencies
```bash
cd /home/jay/.openclaw/workspace/auto-lp-launchpad-design
npm install
```

#### Step 2: Configure Environment
Create `.env` file:
```bash
VITE_LITTERBOX_PROGRAM_ID=<YOUR_PROGRAM_ID_AFTER_DEPLOYMENT>
VITE_LITTER_TOKEN_MINT=<YOUR_LITTER_TOKEN_MINT>
VITE_USDC_MINT=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
VITE_CLUSTER=devnet
```

#### Step 3: Update Program ID
After deploying to Devnet, update the config:
```bash
# In src/context/ProtocolContext.tsx or similar
export const PROGRAM_ID = "<YOUR_DEPLOYED_PROGRAM_ID>";
```

#### Step 4: Run Development Server
```bash
npm run dev
```

#### Step 5: Test Full Workflow
1. **Connect Wallet** (Phantom, Solflare, etc.)
2. **Deposit Test Token** (any SPL token)
3. **View Virtual Pool Status**
4. **Trigger Sweep** (if you have dust tokens)
5. **Graduate** (when threshold is met)
6. **Verify Raydium Pool** (link provided)

---

### Option 2: Quick CLI Testing (No Frontend Needed)

If you just want to **test the backend** without the frontend:

#### Create Test Scripts
```bash
cd /home/jay/.openclaw/workspace/litterbox-v2
mkdir -p scripts
```

**`scripts/test-deposit.ts`:**
```typescript
import { Connection, Keypair } from "@solana/web3.js";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { depositTokens } from "../src/deposit";
import * as fs from "fs";

async function main() {
  const connection = new Connection("https://api.devnet.solana.com");
  const wallet = JSON.parse(fs.readFileSync(process.env.ANCHOR_WALLET!, "utf8"));
  const keypair = Keypair.fromSecretKey(new Uint8Array(wallet));
  
  const provider = new AnchorProvider(connection, {
    publicKey: keypair.publicKey,
    signTransaction: async () => {},
    signAllTransactions: async () => {},
  }, { commitment: "confirmed" });

  const program = new Program(IDL, provider);

  // Test deposit
  const result = await depositTokens({
    connection,
    program,
    user: keypair,
    inputMint: "TOKEN_MINT_HERE",
    amountIn: new BN(1000000), // 1 token
    jupiterApiKey: process.env.JUPITER_API_KEY!,
  });

  console.log("Deposit successful:", result.signature);
}

main().catch(console.error);
```

**Run test:**
```bash
npx ts-node scripts/test-deposit.ts
```

---

## 🧪 Complete Testing Workflow

### Phase 1: Backend Testing (No Frontend)
**Goal:** Verify core logic works

1. ✅ Deploy program to Devnet
2. ✅ Initialize protocol
3. ✅ Test deposit via CLI script
4. ✅ Test sweep via CLI script
5. ✅ Check status via CLI
6. ✅ Trigger graduation (when ready)

**Tools:** CLI scripts only  
**Time:** ~30 minutes  
**Coverage:** Backend logic ✅

---

### Phase 2: Frontend Integration
**Goal:** Verify UI works with backend

1. Update frontend with deployed Program ID
2. Connect wallet
3. Test deposit flow (UI)
4. Test sweep flow (UI)
5. View real-time pool status
6. Test graduation flow (UI)

**Tools:** React frontend  
**Time:** ~1 hour  
**Coverage:** Full stack ✅

---

### Phase 3: End-to-End Testing
**Goal:** Real user experience

1. Fresh wallet setup
2. Acquire test tokens (Devnet SOL, USDC)
3. Use frontend to deposit
4. Monitor pool growth
5. Trigger graduation
6. Verify Raydium pool creation
7. Test post-graduation flush

**Tools:** Full frontend + multiple wallets  
**Time:** ~2-3 hours  
**Coverage:** Complete UX ✅

---

## 📋 Testing Checklist

### Backend (CLI) Tests
- [ ] Program deploys successfully
- [ ] Initialization creates Config + VirtualPool
- [ ] Deposit updates virtual reserves
- [ ] Sweep collects dust tokens
- [ ] Graduation creates Raydium pool
- [ ] Flush adds liquidity to pool
- [ ] All error cases handled correctly

### Frontend (UI) Tests
- [ ] Wallet connects successfully
- [ ] Token selection works
- [ ] Deposit form validates input
- [ ] Transaction confirms on-chain
- [ ] Pool status updates in real-time
- [ ] Graduation button enabled at threshold
- [ ] Raydium pool link works
- [ ] Error messages display correctly

### Integration Tests
- [ ] Full deposit → sweep → graduate flow
- [ ] Multiple users can deposit
- [ ] Permissionless operations work
- [ ] State persists across sessions
- [ ] Events emit correctly

---

## 🛠️ Recommended Approach

### For **Quick Backend Validation** (Today):
1. Deploy program to Devnet
2. Run CLI test scripts
3. Verify core logic works
4. **Time:** 30-60 minutes

### For **Full Frontend Testing** (Tomorrow):
1. Update frontend with Program ID
2. Run `npm run dev`
3. Test complete user flow
4. **Time:** 1-2 hours

### For **Production Readiness** (This Week):
1. Complete all Phase 1-3 tests
2. Fix any bugs found
3. Security review
4. **Time:** 4-8 hours total

---

## 🎯 Immediate Next Steps

### Right Now (Backend Focus):
```bash
# 1. Generate Program ID
solana-keygen new --outfile ~/.solana/wallets/litterbox-v2-keypair.json

# 2. Create $LITTER token (9 decimals!)
spl-token create-token --decimals 9

# 3. Build & Deploy
cd /home/jay/.openclaw/workspace/litterbox-v2
anchor build
anchor deploy --provider.cluster devnet

# 4. Initialize (CLI)
npx ts-node scripts/initialize.ts
```

### After Deployment (Frontend Integration):
```bash
# 1. Update frontend config
cd /home/jay/.openclaw/workspace/auto-lp-launchpad-design
echo "VITE_PROGRAM_ID=<YOUR_ID>" > .env

# 2. Run dev server
npm run dev

# 3. Test in browser
open http://localhost:5173
```

---

## 💡 Pro Tips

1. **Start with CLI testing** - Faster iteration on backend logic
2. **Use Devnet exclusively** - No real money at risk
3. **Test error cases** - Invalid tokens, insufficient balance, etc.
4. **Document everything** - Note any bugs or UX issues
5. **Get second pair of eyes** - Have someone else test the flow

---

## 📚 Resources

- **Frontend Repo:** `/home/jay/.openclaw/workspace/auto-lp-launchpad-design`
- **Backend Repo:** `/home/jay/.openclaw/workspace/litterbox-v2`
- **Solana Devnet Faucet:** https://solfaucet.com/
- **Devnet USDC:** Create your own or use faucet

---

**Bottom Line:** You have everything needed for full testing! Start with CLI scripts for backend validation, then integrate the existing frontend for complete UX testing. 🚀
