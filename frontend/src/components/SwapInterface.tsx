import { useState, useCallback, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { LitterBoxSDK, getLitterBoxSdk } from '../lib/pump-sdk';
import { Transaction } from '@solana/web3.js';

export function SwapInterface() {
  const { connected, publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [mode, setMode] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [slippage] = useState(5.0);
  const [graduationProgress, setGraduationProgress] = useState<number>(0);
  const [isGraduated, setIsGraduated] = useState(false);

  // Initialize SDK
  const sdk = getLitterBoxSdk(connection);

  // Check graduation progress on mount
  useEffect(() => {
    const checkProgress = async () => {
      try {
        // Set token mint (use your deployed token address)
        const tokenMint = import.meta.env.VITE_LITTER_MINT || '';
        if (tokenMint) {
          sdk.setTokenMint(tokenMint);
          const progress = await sdk.getGraduationProgress();
          setGraduationProgress(progress.progressBps);
          setIsGraduated(progress.isGraduated);
        }
      } catch (err) {
        console.error('Error checking progress:', err);
      }
    };
    checkProgress();
  }, [connection]);

  const handleSwap = useCallback(async () => {
    if (!publicKey || !amount) return;

    setLoading(true);
    setError(null);

    try {
      const amountNum = parseFloat(amount);
      let instructions;

      if (mode === 'buy') {
        // Buy tokens (deposit SOL)
        const result = await sdk.buy(publicKey, amountNum);
        instructions = result.instructions;
      } else {
        // Sell tokens (withdraw SOL)
        const result = await sdk.sell(publicKey, amountNum);
        instructions = result.instructions;
      }

      // Build and send transaction
      const transaction = new Transaction().add(...instructions);
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      // Send transaction
      const signature = await sendTransaction(transaction, connection);
      
      setTxSignature(signature);
      setShowPreview(false);
      setAmount('');
      alert(`Transaction sent!\nSignature: ${signature}`);
    } catch (err: any) {
      console.error('Swap error:', err);
      setError(err.message || 'Transaction failed');
    } finally {
      setLoading(false);
    }
  }, [publicKey, amount, mode, connection, sendTransaction, sdk]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowPreview(true);
  };

  const estimatedOutput = mode === 'buy' 
    ? (parseFloat(amount || '0') * 0.95).toFixed(2) // Approximate (actual from SDK)
    : (parseFloat(amount || '0') * 0.95).toFixed(2);

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-2xl p-6 max-w-md w-full mx-4 border border-white/10">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-white">Confirm {mode === 'buy' ? 'Buy' : 'Sell'}</h3>
              <button onClick={() => setShowPreview(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <div className="space-y-4 mb-6">
              <div className="bg-white/5 p-4 rounded-lg">
                <div className="text-sm text-gray-400 mb-1">You {mode === 'buy' ? 'pay' : 'receive'}</div>
                <div className="text-2xl font-bold text-white">{amount} SOL</div>
              </div>
              <div className="text-center text-gray-400">↓</div>
              <div className="bg-white/5 p-4 rounded-lg">
                <div className="text-sm text-gray-400 mb-1">You {mode === 'buy' ? 'receive' : 'pay'}</div>
                <div className="text-2xl font-bold text-white">{estimatedOutput} $LITTER</div>
              </div>
              <div className="bg-white/5 p-4 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Slippage</span>
                  <span className="text-white">{slippage}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Graduation</span>
                  <span className={isGraduated ? 'text-green-400' : 'text-yellow-400'}>
                    {isGraduated ? 'Graduated ✅' : `${graduationProgress}%`}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={handleSwap}
              disabled={loading}
              className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white font-semibold rounded-lg transition"
            >
              {loading ? 'Processing...' : `Confirm ${mode === 'buy' ? 'Buy' : 'Sell'}`}
            </button>
          </div>
        </div>
      )}

      <div className="mb-4 text-center">
        <h2 className="text-2xl font-bold text-white mb-2">
          {mode === 'buy' ? '💰 Buy $Litter' : '💸 Sell $Litter'}
        </h2>
        <p className="text-purple-300 text-sm">
          Official $Litter Token • Powered by Pump.fun
        </p>
      </div>

      <div className="mb-4 p-3 bg-white/10 rounded-lg">
        {connected ? (
          <div className="flex items-center justify-between">
            <span className="text-green-400 text-sm">✅ Wallet Connected</span>
            <button onClick={() => window.location.reload()} className="text-xs text-red-400 hover:text-red-300">
              Disconnect
            </button>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-purple-300 text-sm mb-2">Connect wallet to trade</p>
            <WalletMultiButton />
          </div>
        )}
      </div>

      <div className="flex mb-6">
        <button
          onClick={() => setMode('buy')}
          className={`flex-1 py-2 rounded-l-lg font-semibold transition ${
            mode === 'buy' ? 'bg-purple-600 text-white' : 'bg-white/10 text-purple-200 hover:bg-white/20'
          }`}
        >
          Buy
        </button>
        <button
          onClick={() => setMode('sell')}
          className={`flex-1 py-2 rounded-r-lg font-semibold transition ${
            mode === 'sell' ? 'bg-purple-600 text-white' : 'bg-white/10 text-purple-200 hover:bg-white/20'
          }`}
        >
          Sell
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-purple-200 text-sm mb-2">Amount (SOL)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
            disabled={!connected}
          />
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-2 rounded-lg text-sm">
            {error}
          </div>
        )}

        {txSignature && (
          <div className="bg-green-500/20 border border-green-500 text-green-200 px-4 py-2 rounded-lg text-sm">
            ✅ Success! 
            <a href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`} target="_blank" rel="noopener noreferrer" className="underline block mt-1">
              View on Explorer →
            </a>
          </div>
        )}

        <button
          type="submit"
          disabled={!connected || !amount || loading}
          className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition"
        >
          {loading ? 'Processing...' : connected ? 'Preview Trade' : 'Connect Wallet'}
        </button>
      </form>

      <div className="mt-4 text-sm text-purple-300">
        <p>• Powered by Pump.fun SDK</p>
        <p>• Bonding curve pricing</p>
        <p>• Graduates to Raydium</p>
      </div>
    </div>
  );
}
