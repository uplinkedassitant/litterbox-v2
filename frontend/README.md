# LitterBox v2 Frontend

React + TypeScript frontend for the LitterBox bonding curve platform.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

## 📦 Features

- ✅ Wallet connection (Phantom, Solflare, etc.)
- ✅ Deposit USDC → Get $LITTER
- ✅ Withdraw $LITTER → Get USDC
- ✅ Real-time pool statistics
- ✅ Bonding curve price calculator
- ✅ Jupiter integration (token swaps)

## 🔧 Configuration

Create a `.env` file:

```env
VITE_PROGRAM_ID=CyuzmNggCxLyupt8JBdMdisRn5yo1eUfBPne9BqTnt85
VITE_CONFIG_PDA=<config_pda_address>
VITE_POOL_PDA=<pool_pda_address>
VITE_RPC_URL=https://api.devnet.solana.com
VITE_NETWORK=devnet
```

## 🎨 Tech Stack

- **Framework:** React 18 + TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS
- **Solana:** @solana/wallet-adapter
- **Tokens:** @solana/spl-token

## 📱 Components

### SwapInterface
- Deposit/Withdraw toggle
- Amount input
- Transaction status
- Error handling

### PoolStats
- Virtual reserves
- Real reserves
- Current price
- Pool status

## 🚀 Next Steps

1. Implement actual swap transactions
2. Add Jupiter API integration
3. Add slippage protection
4. Add transaction history
5. Add mobile responsiveness

## 📄 License

MIT
