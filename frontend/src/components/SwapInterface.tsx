import { useState, useCallback, useMemo, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PublicKey, Transaction, TransactionInstruction, LAMPORTS_PER_SOL, SystemProgram } from '@solana/web3.js';
import { Buffer } from 'buffer';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';

const PROGRAM_ID = new PublicKey(
  import.meta.env.VITE_PROGRAM_ID || 'GZMVhkNjd28Jsj8iUuMKfSg1mPdGuXCeUE3khgxxF7DM'
);
const CONFIG_PDA = new PublicKey(
  import.meta.env.VITE_CONFIG_PDA || '61hXQB5wGsfwiMWezrHMe99iyiiiV2Qh5W9VRZnftq1W'
);
const POOL_PDA = new PublicKey(
  import.meta.env.VITE_POOL_PDA || 'HY1dgL4aD7pmvq5WhZUgF3zTLNemsR6FqzaLnA3TEb6g'
);
const LITTER_MINT = new PublicKey(
  import.meta.env.VITE_LITTER_MINT || 'DidDtGhw2vvHaR3KViTjjRypFnuUydCovB8Q2WSz4KC'
);

export function SwapInterface() {
  const { connected, publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [mode, setMode] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [slippage] = useState(1.0);
  const [poolExists, setPoolExists] = useState<boolean | null>(null);
  const [_poolData, setPoolData] = useState<{ virtualLitter: number; virtualSol: number; isActive: boolean } | null>(null);

  // Check if pool exists
  useEffect(() => {
    const checkPool = async () => {
      try {
        const info = await connection.getAccountInfo(POOL_PDA);
        if (info && info.data.length === 40) {
          const virtualLitter = Number(info.data.readBigUInt64LE(0)) / 1e12;
          const virtualSol = Number(info.data.readBigUInt64LE(8)) / 1e9;
          const isActive = info.data[32] === 1;
          setPoolData({ virtualLitter, virtualSol, isActive });
        }
        setPoolExists(!!info);
      } catch (err) {
        console.error('Error checking pool:', err);
        setPoolExists(false);
      }
    };
    checkPool();
  }, [connection]);

  if (poolExists === false) {
    return (
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
        <h2 className="text-2xl font-bold text-white mb-4">⚠️ Pool Not Initialized</h2>
        <p className="text-purple-300 mb-4">
          The liquidity pool needs to be initialized before you can swap.
        </p>
        <div className="bg-yellow-500/20 border border-yellow-500 text-yellow-200 px-4 py-3 rounded-lg mb-4">
          <p className="font-bold mb-2">To initialize:</p>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>Run: <code className="bg-black/20 px-2 py-1 rounded">node scripts/initialize-pool.js</code></li>
            <li>Wait for confirmation</li>
            <li>Refresh this page</li>
          </ol>
        </div>
      </div>
    );
  }

  const handleSwap = useCallback(async () => {
    if (!publicKey || !amount) return;

    setLoading(true);
    setError(null);

    try {
      const amountNum = parseFloat(amount);
      const lamports = Math.floor(amountNum * LAMPORTS_PER_SOL);
      const litterAmount = Math.floor(amountNum * 1_000_000_000_000); // 12 decimals
      
      // Get token accounts
      const userLitterAta = await getAssociatedTokenAddress(publicKey, LITTER_MINT);
      const poolLitterAta = await getAssociatedTokenAddress(POOL_PDA, LITTER_MINT);
      
      // Create instruction data
      const data = Buffer.alloc(9);
      data[0] = mode === 'deposit' ? 1 : 2; // 1 for deposit, 2 for withdraw
      data.writeBigUInt64LE(BigInt(lamports), 1);

      // Create instruction with all required accounts
      const instruction = new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
          { pubkey: publicKey, isSigner: true, isWritable: true },
          { pubkey: CONFIG_PDA, isSigner: false, isWritable: true },
          { pubkey: POOL_PDA, isSigner: false, isWritable: true },
          { pubkey: userLitterAta, isSigner: false, isWritable: true },
          { pubkey: poolLitterAta, isSigner: false, isWritable: true },
          { pubkey: LITTER_MINT, isSigner: false, isWritable: false },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        data: data,
      });

      const transaction = new Transaction().add(instruction);
      
      // Add SOL transfer for deposit
      if (mode === 'deposit') {
        // Transfer SOL to pool PDA
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: POOL_PDA,
            lamports: lamports,
          })
        );
      }

      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      // Simulate first
      console.log('Simulating transaction...');
      try {
        const simulation = await connection.simulateTransaction(transaction);
        console.log('Simulation result:', simulation);
        if (simulation.value.logs) {
          console.log('Program logs:', simulation.value.logs);
        }
        if (simulation.value.err) {
          console.error('Simulation error:', simulation.value.err);
          throw new Error(`Simulation failed: ${JSON.stringify(simulation.value.err)}`);
        }
      } catch (simError: any) {
        console.error('Simulation error:', simError);
        if (simError.logs) {
          console.log('Simulation logs:', simError.logs);
        }
        if (simError.cause) {
          console.error('Error cause:', simError.cause);
        }
        throw simError;
      }

      console.log('Sending transaction...');
      const signature = await sendTransaction(transaction, connection);
      console.log('Transaction sent:', signature);
      
      setTxSignature(signature);
      setShowPreview(false);
      setAmount('');
      alert(`Transaction sent!\nSignature: ${signature}`);
    } catch (err: any) {
      console.error('Swap error:', err);
      let errorMessage = err.message || 'Transaction failed';
      
      if (err.logs) {
        console.log('Program logs:', err.logs);
        const programError = err.logs.find((log: string) => 
          log.toLowerCase().includes('error') || 
          log.toLowerCase().includes('failed') ||
          log.toLowerCase().includes('missing')
        );
        if (programError) {
          errorMessage = `Program error: ${programError}`;
        }
      }
      
      if (err.cause) {
        console.error('Error cause:', err.cause);
        errorMessage = err.cause.toString ? err.cause.toString() : String(err.cause);
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [publicKey, amount, mode, connection, sendTransaction]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowPreview(true);
  };

  const estimatedOutput = useMemo(() => {
    if (!amount || isNaN(parseFloat(amount))) return '0.00';
    const amountNum = parseFloat(amount);
    const output = amountNum * 0.98; // 2% fee
    return output.toFixed(6);
  }, [amount]);

  const priceImpact = useMemo(() => {
    if (!amount || parseFloat(amount) === 0) return 0;
    return Math.min(parseFloat(amount) / 1000, 0.1);
  }, [amount]);

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-2xl p-6 max-w-md w-full mx-4 border border-white/10">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-white">Confirm Swap</h3>
              <button onClick={() => setShowPreview(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <div className="space-y-4 mb-6">
              <div className="bg-white/5 p-4 rounded-lg">
                <div className="text-sm text-gray-400 mb-1">You pay</div>
                <div className="text-2xl font-bold text-white">{amount} {mode === 'deposit' ? 'SOL' : '$LITTER'}</div>
              </div>
              <div className="text-center text-gray-400">↓</div>
              <div className="bg-white/5 p-4 rounded-lg">
                <div className="text-sm text-gray-400 mb-1">You receive</div>
                <div className="text-2xl font-bold text-white">{estimatedOutput} {mode === 'deposit' ? '$LITTER' : 'SOL'}</div>
              </div>
              <div className="bg-white/5 p-4 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Price Impact</span>
                  <span className={priceImpact > 0.03 ? 'text-red-400' : 'text-green-400'}>
                    {(priceImpact * 100).toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Slippage</span>
                  <span className="text-white">{slippage}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Platform Fee</span>
                  <span className="text-white">2%</span>
                </div>
              </div>
            </div>
            <button
              onClick={handleSwap}
              disabled={loading}
              className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white font-semibold rounded-lg transition"
            >
              {loading ? 'Processing...' : 'Confirm Swap'}
            </button>
          </div>
        </div>
      )}

      <h2 className="text-2xl font-bold text-white mb-4">
        {mode === 'deposit' ? '💰 Deposit SOL' : '💸 Withdraw SOL'}
      </h2>

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
            <p className="text-purple-300 text-sm mb-2">Connect wallet to swap</p>
            <WalletMultiButton />
          </div>
        )}
      </div>

      <div className="flex mb-6">
        <button
          onClick={() => setMode('deposit')}
          className={`flex-1 py-2 rounded-l-lg font-semibold transition ${
            mode === 'deposit' ? 'bg-purple-600 text-white' : 'bg-white/10 text-purple-200 hover:bg-white/20'
          }`}
        >
          Deposit
        </button>
        <button
          onClick={() => setMode('withdraw')}
          className={`flex-1 py-2 rounded-r-lg font-semibold transition ${
            mode === 'withdraw' ? 'bg-purple-600 text-white' : 'bg-white/10 text-purple-200 hover:bg-white/20'
          }`}
        >
          Withdraw
        </button>
      </div>

      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-purple-200">Slippage Tolerance</span>
          <span className="text-sm text-white">{slippage}%</span>
        </div>
        <div className="flex gap-2">
          {[0.5, 1.0, 2.0, 5.0].map((opt) => (
            <button
              key={opt}
              className={`flex-1 py-1 rounded text-sm transition ${
                slippage === opt ? 'bg-purple-600 text-white' : 'bg-white/10 text-purple-200 hover:bg-white/20'
              }`}
            >
              {opt}%
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-purple-200 text-sm mb-2">Amount</label>
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
          {loading ? 'Processing...' : connected ? 'Preview Swap' : 'Connect Wallet'}
        </button>
      </form>

      {amount && (
        <div className="mt-4 p-3 bg-white/5 rounded-lg text-sm space-y-2">
          <div className="flex justify-between text-purple-200">
            <span>Estimated Output</span>
            <span className="text-white font-semibold">{estimatedOutput} {mode === 'deposit' ? '$LITTER' : 'SOL'}</span>
          </div>
          <div className="flex justify-between text-purple-200">
            <span>Price Impact</span>
            <span className={priceImpact > 0.03 ? 'text-red-400' : 'text-green-400'}>
              {(priceImpact * 100).toFixed(2)}%
            </span>
          </div>
        </div>
      )}

      <div className="mt-4 text-sm text-purple-300">
        <p>• Platform fee: 2%</p>
        <p>• Powered by Solana</p>
        <p>• Bonding curve pricing</p>
      </div>
    </div>
  );
}
