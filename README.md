# 🐱‍👤 LitterBox v2

**Jupiter-Powered Bonding Curve Platform on Solana**

Turn any token into a tradable asset with algorithmic pricing via bonding curves.

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Rust + Solana Tool Suite
- npm or yarn

### 1. Install Dependencies
```bash
npm install
```

### 2. Build Program
```bash
cargo build-sbf
```

### 3. Deploy to Devnet
```bash
solana program deploy target/deploy/litterbox_v2.so --url devnet
```

### 4. Initialize Pool
```bash
npx ts-node scripts/init-program.ts
```

### 5. Deploy Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## 📦 Features

- ✅ **Bonding Curve Pricing** - Algorithmic price discovery
- ✅ **Jupiter Integration** - Swap any token via USDC bridge
- ✅ **2% Platform Fee** - Sustainable revenue model
- ✅ **Permissionless** - Anyone can create pools
- ✅ **Non-custodial** - Users retain control of funds

---

## 🏗️ Architecture

### Program Structure
```
program/
├── src/
│   └── lib.rs          # Core program logic
├── Cargo.toml
└── Xargo.toml
```

### Frontend Structure
```
frontend/
├── src/
│   ├── App.tsx         # Main app component
│   ├── components/
│   │   ├── SwapInterface.tsx
│   │   └── PoolStats.tsx
│   └── index.css
├── .env                # Environment variables
└── vercel.json         # Vercel config
```

### Scripts
```
scripts/
├── init-program.ts     # Initialize pool
├── test-swap.ts        # Test deposit
└── test-withdraw.ts    # Test withdraw
```

---

## 🔧 Configuration

### Environment Variables

Create `frontend/.env.local`:
```bash
VITE_PROGRAM_ID=AX6vgdmqDXRVd3kNwT8Xt7B49GcDTDFR4LwV7caxmZCG
VITE_CONFIG_PDA=GSyYSVVz9yrk6XSeF9zMi9GzvtUk47mKVhjKJVW4HTGZ
VITE_POOL_PDA=H3LwN5cS6zyX3iU8PwnDMXh4RbFAmwBKGkg81UzGuwFt
VITE_RPC_URL=https://api.devnet.solana.com
VITE_NETWORK=devnet
```

### ⚠️ Security Warning
- **NEVER** commit `.env` files with real values
- **NEVER** commit keypair JSON files
- Use `.env.example` as a template
- Add sensitive files to `.gitignore`

---

## 📊 Pool Mechanics

### Bonding Curve Formula
```
litter_amount = (usdc_amount * virtual_litter) / (virtual_usdc + usdc_amount)
```

### Fees
- **Deposit Fee:** 2% (deducted from $LITTER)
- **Withdraw Fee:** 2% (deducted from USDC)

### Initial State
- Virtual Litter: 1.00
- Virtual USDC: 1.00
- Real Reserves: 0.00
- Status: Inactive (activates on first deposit)

---

## 🚀 Deployment

### Solana Program
```bash
# Build
cargo build-sbf

# Deploy
solana program deploy target/deploy/litterbox_v2.so --url devnet
```

### Frontend (Vercel)
```bash
cd frontend

# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

Add environment variables in Vercel dashboard.

---

## 🧪 Testing

### Test Deposit
```bash
npx ts-node scripts/test-swap.ts 100
```

### Test Withdraw
```bash
npx ts-node scripts/test-withdraw.ts 89
```

### Check Pool State
```bash
npx ts-node scripts/check-pool.ts
```

---

## 📁 Key Files

| File | Purpose |
|------|---------|
| `program/src/lib.rs` | Core program logic |
| `frontend/src/App.tsx` | Main React app |
| `scripts/init-program.ts` | Pool initialization |
| `.gitignore` | Git ignore rules |
| `DEPLOYMENT-SUCCESS.md` | Deployment guide |
| `DEPLOY-FRONTEND.md` | Frontend deployment |

---

## 🔐 Security

### What's Protected
- ✅ Keypairs in `.gitignore`
- ✅ Environment variables not committed
- ✅ Build artifacts ignored
- ✅ Sensitive data excluded

### Best Practices
1. Use `.env.local` for local development
2. Never commit `*.json` except config files
3. Use Vercel environment variables for production
4. Regularly audit dependencies

---

## 📚 Documentation

- [Deployment Guide](DEPLOYMENT-SUCCESS.md)
- [Frontend Deployment](DEPLOY-FRONTEND.md)
- [Phase 2 Summary](PHASE2-SUMMARY.md)
- [Phase 4 Summary](PHASE4-SUMMARY.md)
- [Phase 5 Summary](PHASE5-SUMMARY.md)

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

## 📄 License

MIT License - see LICENSE file for details.

---

## 🌐 Links

- **GitHub:** https://github.com/uplinkedassitant/litterbox-v2
- **Live Demo:** https://litterbox-v2.vercel.app (when deployed)
- **Solana Devnet:** https://explorer.solana.com/?cluster=devnet

---

**Built with ❤️ on Solana**
