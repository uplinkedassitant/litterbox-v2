import { useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';

const PROGRAM_ID = import.meta.env.VITE_PROGRAM_ID || 'AX6vgdmqDXRVd3kNwT8Xt7B49GcDTDFR4LwV7caxmZCG';
const CONFIG_PDA = import.meta.env.VITE_CONFIG_PDA || 'GSyYSVVz9yrk6XSeF9zMi9GzvtUk47mKVhjKJVW4HTGZ';
const POOL_PDA = import.meta.env.VITE_POOL_PDA || 'H3LwN5cS6zyX3iU8PwnDMXh4RbFAmwBKGkg81UzGuwFt';

export function SwapInterface() {
  const { connected, publicKey, signTransaction, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [mode, setMode] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);

  const handleDeposit = async (usdcAmount: number) => {
    if (!publicKey || !signTransaction) throw new Error('Wallet not connected');

    const programId = new PublicKey(PROGRAM_ID);
    const configPda = new PublicKey(CONFIG_PDA);
    const poolPda = new PublicKey(POOL_PDA);

    // Note: This is a simplified version - in production you'd need:
    // - USDC mint address
    // - User's USDC ATA
    // - Pool's USDC ATA  
    // - User's Litter ATA
    // - Pool's Litter ATA
    // - Actual token transfer instructions
    
    const instruction = new TransactionInstruction({
      programId,
      keys: [
        { pubkey: publicKey, isSigner: true, isWritable: true },
        { pubkey: configPda, isSigner: false, isWritable: true },
        { pubkey: poolPda, isSigner: false, isWritable: true },
        // Add token accounts here
      ],
      data: Buffer.from([1, ...new Uint8Array(8).fill(0)]), // Swap discriminator + amount
    });

    const transaction = new Transaction().add(instruction);
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = publicKey;

    const signature = await sendTransaction(transaction, connection);
    return signature;
  };

  const handleWithdraw = async (litterAmount: number) => {
    if (!publicKey || !signTransaction) throw new Error('Wallet not connected');

    const programId = new PublicKey(PROGRAM_ID);
    const configPda = new PublicKey(CONFIG_PDA);
    const poolPda = new PublicKey(POOL_PDA);

    const instruction = new TransactionInstruction({
      programId,
      keys: [
        { pubkey: publicKey, isSigner: true, isWritable: true },
        { pubkey: configPda, isSigner: false, isWritable: true },
        { pubkey: poolPda, isSigner: false, isWritable: true },
        // Add token accounts here
      ],
      data: Buffer.from([2, ...new Uint8Array(8).fill(0)]), // Withdraw discriminator + amount
    });

    const transaction = new Transaction().add(instruction);
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = publicKey;

    const signature = await sendTransaction(transaction, connection);
    return signature;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicKey || !amount) return;

    setLoading(true);
    setError(null);

    try {
      const amountNum = parseFloat(amount);
      let signature: string;

      if (mode === 'deposit') {
        signature = await handleDeposit(amountNum);
      } else {
        signature = await handleWithdraw(amountNum);
      }

      setTxSignature(signature);
      alert(`Transaction successful!\nSignature: ${signature}`);
      setAmount('');
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
            className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
            disabled={!connected}
          />
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-2 rounded-lg">
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
          {loading ? 'Processing...' : connected ? 'Swap' : 'Connect Wallet First'}
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
