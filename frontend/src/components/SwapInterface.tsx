import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '@solana/wallet-adapter-react';

export function SwapInterface() {
  const { connected, publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [mode, setMode] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicKey || !amount) return;

    setLoading(true);
    setError(null);

    try {
      // TODO: Implement actual swap logic
      alert('Swap functionality coming in next update!');
    } catch (err: any) {
      setError(err.message || 'Transaction failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
      <h2 className="text-2xl font-bold text-white mb-4">
        {mode === 'deposit' ? '💰 Deposit USDC' : '💸 Withdraw USDC'}
      </h2>

      {/* Mode Toggle */}
      <div className="flex mb-6">
        <button
          onClick={() => setMode('deposit')}
          className={`flex-1 py-2 rounded-l-lg font-semibold transition ${
            mode === 'deposit'
              ? 'bg-purple-600 text-white'
              : 'bg-white/10 text-purple-200 hover:bg-white/20'
          }`}
        >
          Deposit
        </button>
        <button
          onClick={() => setMode('withdraw')}
          className={`flex-1 py-2 rounded-r-lg font-semibold transition ${
            mode === 'withdraw'
              ? 'bg-purple-600 text-white'
              : 'bg-white/10 text-purple-200 hover:bg-white/20'
          }`}
        >
          Withdraw
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-purple-200 text-sm mb-2">
            Amount ({mode === 'deposit' ? 'USDC' : '$LITTER'})
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
            disabled={!connected}
          />
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-2 rounded-lg">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!connected || !amount || loading}
          className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition"
        >
          {loading ? 'Processing...' : connected ? 'Swap' : 'Connect Wallet'}
        </button>
      </form>

      {/* Info */}
      <div className="mt-4 text-sm text-purple-300">
        <p>• Platform fee: 2%</p>
        <p>• Powered by Jupiter</p>
        <p>• Bonding curve pricing</p>
      </div>
    </div>
  );
}
