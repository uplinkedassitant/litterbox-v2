# 🚀 LitterBox v2 Deployment Checklist

This checklist ensures your LitterBox v2 platform is properly deployed and initialized on any Solana network (Devnet, Mainnet).

---

## 📋 Pre-Deployment Requirements

### 1. Environment Setup
- [ ] Node.js 18+ installed
- [ ] Rust + Solana Tool Suite installed
- [ ] npm or yarn installed
- [ ] Vercel account connected to GitHub

### 2. Solana Configuration
- [ ] Solana CLI configured (`solana config set --url <network>`)
- [ ] Keypair created and funded (`~/.config/solana/id_litterbox_v2.json`)
- [ ] Minimum 2 SOL balance for deployment and initialization

### 3. Network Selection
Choose your target network:
- **Devnet**: `solana config set --url devnet`
- **Mainnet**: `solana config set --url mainnet`

---

## 🏗️ Step 1: Deploy Program to Solana

```bash
# Navigate to program directory
cd /home/jay/.openclaw/workspace/litterbox-v2

# Build the program
cargo build-sbf

# Deploy to Solana
solana program deploy target/deploy/litterbox_v2.so --keypair ~/.config/solana/id_litterbox_v2.json
```

**✅ Success:** You'll get a Program ID (e.g., `AX6vgdmqDXRVd3kNwT8Xt7B49GcDTDFR4LwV7caxmZCG`)

**📝 Record:** Save the Program ID - you'll need it for frontend configuration!

---

## 🪙 Step 2: Initialize the Pool (One-Time Only)

```bash
# Navigate to project root
cd /home/jay/.openclaw/workspace/litterbox-v2

# Run initialization script
node scripts/init-pool.js
```

**What this does:**
- Creates Config PDA (stores program configuration)
- Creates Pool PDA (stores liquidity pool state)
- Mints $Litter token (1B supply)
- Sets initial virtual reserves
- Activates the pool

**✅ Success:** You'll see:
```
✅ Program initialized!
Transaction: https://explorer.solana.com/tx/<signature>?cluster=<network>
```

**📝 Record:** Save these addresses:
- Config PDA: `GSyYSVVz9yrk6XSeF9zMi9GzvtUk47mKVhjKJVW4HTGZ`
- Pool PDA: `H3LwN5cS6zyX3iU8PwnDMXh4RbFAmwBKGkg81UzGuwFt`
- Litter Mint: (from script output)

---

## 🌐 Step 3: Deploy Frontend to Vercel

### 3A. Configure Environment Variables

Create `frontend/.env.local` (for local testing):
```env
VITE_PROGRAM_ID=AX6vgdmqDXRVd3kNwT8Xt7B49GcDTDFR4LwV7caxmZCG
VITE_CONFIG_PDA=GSyYSVVz9yrk6XSeF9zMi9GzvtUk47mKVhjKJVW4HTGZ
VITE_POOL_PDA=H3LwN5cS6zyX3iU8PwnDMXh4RbFAmwBKGkg81UzGuwFt
VITE_RPC_URL=https://api.devnet.solana.com
VITE_NETWORK=devnet
```

### 3B. Deploy via Vercel Dashboard

1. Go to https://vercel.com/new
2. Import your GitHub repository: `uplinkedassitant/litterbox-v2`
3. Set **Root Directory**: `frontend`
4. Add environment variables (same as `.env.local` above)
5. Click **Deploy**

### 3C. Deploy via Vercel CLI

```bash
cd frontend
npm install
vercel --prod
```

**✅ Success:** Your frontend is live at `https://litterbox-v2.vercel.app`

---

## ✅ Step 4: Verify Deployment

### 4A. Check Program
```bash
solana program show <PROGRAM_ID>
```

### 4B. Check Pool Account
```bash
solana account <POOL_PDA>
```

### 4C. Check Frontend
1. Open your Vercel URL
2. Connect wallet (Phantom)
3. Check Pool Stats - should show "Active" status
4. Try a small test swap (0.1 USDC)

---

## 🔧 Troubleshooting

### Pool Not Initialized Error
**Symptom:** Frontend shows "Pool Not Initialized"
**Solution:** Run Step 2 (initialization script)

### Transaction Fails
**Symptom:** "Unexpected error at sendTransaction"
**Solution:** 
1. Check pool exists: `solana account <POOL_PDA>`
2. Check program is deployed: `solana program show <PROGRAM_ID>`
3. Verify environment variables match deployed addresses

### Build Fails on Vercel
**Symptom:** TypeScript errors in build log
**Solution:** 
1. Check `npm run build` works locally
2. Verify all imports are correct
3. Clear Vercel build cache and redeploy

---

## 🎯 Mainnet Deployment (Production)

When ready for mainnet:

### Additional Steps:
1. **Switch network:** `solana config set --url mainnet`
2. **Fund keypair:** Transfer SOL to deployment keypair
3. **Deploy program:** Same command, different network
4. **Initialize pool:** Same script, mainnet accounts
5. **Update env vars:** Change RPC URL to mainnet
6. **Redeploy frontend:** `vercel --prod`
7. **Test thoroughly:** Small amounts first!

### Mainnet Checklist:
- [ ] Program deployed to mainnet
- [ ] Pool initialized on mainnet
- [ ] Frontend env vars updated to mainnet RPC
- [ ] Environment variables updated in Vercel
- [ ] Tested with small amounts
- [ ] Security audit completed
- [ ] Legal/compliance review done
- [ ] Community announcement prepared

---

## 📊 Post-Deployment Monitoring

### Monitor Pool Activity
```bash
# Check pool state
solana account <POOL_PDA>

# View transactions
solana signatures <PROGRAM_ID>
```

### Monitor Frontend
- Vercel Analytics (traffic)
- Browser console (errors)
- User feedback (Discord/Twitter)

### Regular Maintenance
- [ ] Check SOL balance (for rent/fees)
- [ ] Monitor pool liquidity
- [ ] Review error logs
- [ ] Update dependencies (security patches)
- [ ] Backup keypair (securely!)

---

## 🔐 Security Best Practices

### Keypair Security
- ✅ Store keypair in secure location
- ✅ Never commit keypair to Git
- ✅ Use separate keypairs for dev/prod
- ✅ Backup keypair (encrypted, multiple locations)
- ❌ Never share keypair publicly

### Environment Variables
- ✅ Use Vercel environment variables
- ✅ Never commit `.env` files with real values
- ✅ Use `.env.example` as template
- ✅ Rotate secrets regularly

### Program Security
- ✅ Test thoroughly on Devnet first
- ✅ Start with small liquidity on Mainnet
- ✅ Consider third-party audit
- ✅ Have upgrade authority plan
- ✅ Monitor for exploits

---

## 📞 Support

If you encounter issues:
1. Check this checklist
2. Review troubleshooting section
3. Check GitHub Issues
4. Contact maintainer

---

**Last Updated:** 2026-03-28
**Version:** 1.0.0
**Network:** Devnet → Mainnet ready
