import { useState, useMemo, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Transaction } from '@solana/web3.js';
import {
  createSwapInstruction,
  createWithdrawInstruction,
  findAssociatedTokenAddress,
  USDC_MINT,
  POOL_PDA,
} from '../utils/litterbox-client';

// Token options for selection
const TOKEN_OPTIONS = [
  { symbol: 'USDC', name: 'USD Coin', mint: USDC_MINT.toString(), decimals: 6, icon: '💵' },
  { symbol: 'SOL', name: 'Solana', mint: 'So11111111111111111111111111111111111111112', decimals: 9, icon: '◎' },
];

// Slippage options
const SLIPPAGE_OPTIONS = [0.5, 1.0, 2.0, 5.0];

interface TokenBalance {
  symbol: string;
  balance: number;
  usdValue?: number;
}

export function SwapInterface() {
  const { connected, publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  
  // Swap state
  const [mode, setMode] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState('');
  const [selectedToken, setSelectedToken] = useState(TOKEN_OPTIONS[0]);
  const [slippage, setSlippage] = useState(1.0); // 1% default
  const [showTokenSelect, setShowTokenSelect] = useState(false);
  
  // Loading and error state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Calculate estimated output based on bonding curve
  const estimatedOutput = useMemo(() => {
    if (!amount || isNaN(parseFloat(amount))) return '0.00';
    const amountNum = parseFloat(amount);
    // Simplified bonding curve calculation (replace with actual formula)
    const output = mode === 'deposit' 
      ? amountNum * 0.98 // 2% fee
      : amountNum * 0.98; // 2% fee
    return output.toFixed(6);
  }, [amount, mode]);

  // Price impact calculation
  const priceImpact = useMemo(() => {
    if (!amount || parseFloat(amount) === 0) return 0;
    // Simplified price impact (replace with actual calculation)
    return Math.min(parseFloat(amount) / 1000, 0.1); // Cap at 10%
  }, [amount]);

  const handleSwap = useCallback(async () => {
    if (!publicKey || !amount) return;

    setLoading(true);
    setError(null);

    try {
      const amountNum = parseFloat(amount);
      
      // Find token accounts
      const userUsdcAta = await findAssociatedTokenAddress(publicKey, USDC_MINT);
      const poolUsdcAta = await findAssociatedTokenAddress(POOL_PDA, USDC_MINT);
      const userLitterAta = await findAssociatedTokenAddress(publicKey, POOL_PDA);
      
      let signature: string;

      if (mode === 'deposit') {
        const instruction = createSwapInstruction(
          publicKey,
          userUsdcAta,
          poolUsdcAta,
          userLitterAta,
          USDC_MINT,
          amountNum
        );
        
        const transaction = new Transaction().add(instruction);
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = publicKey;

        signature = await sendTransaction(transaction, connection);
      } else {
        const instruction = createWithdrawInstruction(
          publicKey,
          userUsdcAta,
          poolUsdcAta,
          userLitterAta,
          USDC_MINT,
          amountNum
        );
        
        const transaction = new Transaction().add(instruction);
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = publicKey;

        signature = await sendTransaction(transaction, connection);
      }

      setTxSignature(signature);
      setShowPreview(false);
      setAmount('');
      alert(`Transaction successful!\nSignature: ${signature}`);
    } catch (err: any) {
      console.error('Swap error:', err);
      let errorMessage = err.message || 'Transaction failed';
      if (err.logs) {
        console.log('Program logs:', err.logs);
        const programError = err.logs.find((log: string) => log.includes('Error') || log.includes('failed'));
        if (programError) {
          errorMessage = `Program error: ${programError}`;
        }
      }
      if (err.cause) {
        console.error('Error cause:', err.cause);
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

  const TokenSelector = () => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-2xl p-6 max-w-md w-full mx-4 border border-white/10">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-white">Select Token</h3>
          <button
            onClick={() => setShowTokenSelect(false)}
            className="text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>
        <div className="space-y-2">
          {TOKEN_OPTIONS.map((token) => (
            <button
              key={token.symbol}
              onClick={() => {
                setSelectedToken(token);
                setShowTokenSelect(false);
              }}
              className={`w-full flex items-center p-3 rounded-lg transition ${
                selectedToken.symbol === token.symbol
                  ? 'bg-purple-600'
                  : 'bg-white/5 hover:bg-white/10'
              }`}
            >
              <span className="text-2xl mr-3">{token.icon}</span>
              <div className="text-left">
                <div className="font-semibold text-white">{token.symbol}</div>
                <div className="text-sm text-gray-400">{token.name}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const TransactionPreview = () => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-2xl p-6 max-w-md w-full mx-4 border border-white/10">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-white">Confirm Swap</h3>
          <button
            onClick={() => setShowPreview(false)}
            className="text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 mb-6">
          <div className="bg-white/5 p-4 rounded-lg">
            <div className="text-sm text-gray-400 mb-1">You pay</div>
            <div className="text-2xl font-bold text-white">
              {amount} {selectedToken.symbol}
            </div>
          </div>

          <div className="text-center text-gray-400">↓</div>

          <div className="bg-white/5 p-4 rounded-lg">
            <div className="text-sm text-gray-400 mb-1">You receive</div>
            <div className="text-2xl font-bold text-white">
              {estimatedOutput} $LITTER
            </div>
          </div>

          <div className="bg-white/5 p-4 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Price Impact</span>
              <span className={priceImpact > 0.03 ? 'text-red-400' : 'text-green-400'}>
                {(priceImpact * 100).toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Slippage Tolerance</span>
              <span className="text-white">{slippage}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Platform Fee</span>
              <span className="text-white">2%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Network Fee</span>
              <span className="text-white">~$0.0001</span>
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
  );

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
      {showTokenSelect && <TokenSelector />}
      {showPreview && <TransactionPreview />}

      <h2 className="text-2xl font-bold text-white mb-4">
        {mode === 'deposit' ? '💰 Deposit' : '💸 Withdraw'}
      </h2>

      {/* Wallet Status */}
      <div className="mb-4 p-3 bg-white/10 rounded-lg">
        {connected ? (
          <div className="flex items-center justify-between">
            <span className="text-green-400 text-sm">✅ Wallet Connected</span>
            <button
              onClick={() => window.location.reload()}
              className="text-xs text-red-400 hover:text-red-300"
            >
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

      {/* Slippage Settings */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-purple-200">Slippage Tolerance</span>
          <span className="text-sm text-white">{slippage}%</span>
        </div>
        <div className="flex gap-2">
          {SLIPPAGE_OPTIONS.map((opt) => (
            <button
              key={opt}
              onClick={() => setSlippage(opt)}
              className={`flex-1 py-1 rounded text-sm transition ${
                slippage === opt
                  ? 'bg-purple-600 text-white'
                  : 'bg-white/10 text-purple-200 hover:bg-white/20'
              }`}
            >
              {opt}%
            </button>
          ))}
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-purple-200 text-sm mb-2">
            Amount
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="flex-1 px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
              disabled={!connected}
            />
            <button
              type="button"
              onClick={() => setShowTokenSelect(true)}
              className="px-4 py-3 bg-white/10 hover:bg-white/20 rounded-lg text-white font-semibold transition flex items-center gap-2"
            >
              <span>{selectedToken.icon}</span>
              <span>{selectedToken.symbol}</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-2 rounded-lg text-sm">
            {error}
          </div>
        )}

        {txSignature && (
          <div className="bg-green-500/20 border border-green-500 text-green-200 px-4 py-2 rounded-lg text-sm">
            ✅ Success! 
            <a 
              href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline block mt-1"
            >
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

      {/* Exchange Rate Info */}
      {amount && (
        <div className="mt-4 p-3 bg-white/5 rounded-lg text-sm space-y-2">
          <div className="flex justify-between text-purple-200">
            <span>Estimated Output</span>
            <span className="text-white font-semibold">{estimatedOutput} $LITTER</span>
          </div>
          <div className="flex justify-between text-purple-200">
            <span>Price Impact</span>
            <span className={priceImpact > 0.03 ? 'text-red-400' : 'text-green-400'}>
              {(priceImpact * 100).toFixed(2)}%
            </span>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="mt-4 text-sm text-purple-300">
        <p>• Platform fee: 2%</p>
        <p>• Powered by Jupiter</p>
        <p>• Bonding curve pricing</p>
      </div>
    </div>
  );
}
