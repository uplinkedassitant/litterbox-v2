import { FC, useMemo } from 'react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { ConnectionProvider, WalletProvider, useWallet } from '@solana/wallet-adapter-react';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';
import { SwapInterface } from './components/SwapInterface';
import { PoolStats } from './components/PoolStats';
import '@solana/wallet-adapter-react-ui/styles.css';

const PROGRAM_ID = import.meta.env.VITE_PROGRAM_ID || 'CyuzmNggCxLyupt8JBdMdisRn5yo1eUfBPne9BqTnt85';
const RPC_URL = import.meta.env.VITE_RPC_URL || 'https://api.devnet.solana.com';

function AppContent() {
  const { connected, publicKey } = useWallet();

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">
              🐱‍👤 LitterBox v2
            </h1>
            <p className="text-purple-200">
              Jupiter-Powered Bonding Curve Platform
            </p>
          </div>
          <WalletMultiButton />
        </header>

        {/* Main Content */}
        <main className="grid md:grid-cols-2 gap-8">
          {/* Swap Interface */}
          <div>
            <SwapInterface />
          </div>

          {/* Pool Stats */}
          <div>
            <PoolStats />
          </div>
        </main>

        {/* Footer */}
        <footer className="mt-12 text-center text-purple-300">
          <p>Program: {PROGRAM_ID}</p>
          <p className="text-sm mt-2">
            Turn your memecoins into $LITTER • Powered by Jupiter
          </p>
        </footer>
      </div>
    </div>
  );
}

const App: FC = () => {
  const network = import.meta.env.VITE_NETWORK || 'devnet';
  const endpoint = useMemo(() => RPC_URL, [network]);

  return (
    <ConnectionProvider config={{ commitment: 'confirmed' }} endpoint={endpoint}>
      <WalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>
          <AppContent />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

export default App;
