import { FC, useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { SwapInterface } from './components/SwapInterface';
import { PoolStats } from './components/PoolStats';
import '@solana/wallet-adapter-react-ui/styles.css';

const RPC_URL = import.meta.env.VITE_RPC_URL || 'https://api.devnet.solana.com';

function AppContent() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="container mx-auto px-4 py-8">
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

        <main className="grid md:grid-cols-2 gap-8">
          <div>
            <SwapInterface />
          </div>

          <div>
            <PoolStats />
          </div>
        </main>

        <footer className="mt-12 text-center text-purple-300">
          <p className="text-sm mt-2">
            Turn any token into $LITTER • Powered by Jupiter
          </p>
        </footer>
      </div>
    </div>
  );
}

const App: FC = () => {
  const endpoint = useMemo(() => RPC_URL, []);
  
  const wallets = useMemo(() => [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
  ], []);

  return (
    <ConnectionProvider config={{ commitment: 'confirmed' }} endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <AppContent />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

export default App;
