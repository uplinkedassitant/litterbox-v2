#!/usr/bin/env node

/**
 * LitterBox v2 - First Deposit Script
 * 
 * Makes the first deposit to activate the pool.
 * This is needed because the pool starts inactive.
 * 
 * Usage:
 *   node scripts/first-deposit.js [amount]
 *   
 * Example:
 *   node scripts/first-deposit.js 100
 */

const {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} = require('@solana/web3.js');
const {
  getOrCreateAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
} = require('@solana/spl-token');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Configuration
const PROGRAM_ID = new PublicKey('AX6vgdmqDXRVd3kNwT8Xt7B49GcDTDFR4LwV7caxmZCG');
const CONFIG_PDA = new PublicKey('GSyYSVVz9yrk6XSeF9zMi9GzvtUk47mKVhjKJVW4HTGZ');
const POOL_PDA = new PublicKey('H3LwN5cS6zyX3iU8PwnDMXh4RbFAmwBKGkg81UzGuwFt');
const USDC_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'); // Devnet USDC
const LITTER_MINT = new PublicKey('TODO_GET_FROM_POOL'); // Will get from pool data

const RPC_URL = 'https://api.devnet.solana.com';

async function main() {
  console.log('🐱‍👤 LitterBox v2 - First Deposit\n');
  console.log('═══════════════════════════════════════════\n');

  const amount = parseFloat(process.argv[2] || '100'); // Default 100 USDC
  console.log(`Amount: ${amount} USDC`);

  // Load keypair
  const keypairPath = path.join(os.homedir(), '.config/solana/id_litterbox_v2.json');
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
  const authority = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  
  console.log(`Authority: ${authority.publicKey.toString()}\n`);

  const connection = new Connection(RPC_URL, 'confirmed');

  // Check balance
  const balance = await connection.getBalance(authority.publicKey);
  console.log(`SOL Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);

  if (balance < 0.1 * LAMPORTS_PER_SOL) {
    console.error('❌ Insufficient SOL balance');
    return;
  }

  console.log('\n⚠️  NOTE: This script requires USDC tokens in your wallet.');
  console.log('   Please ensure you have USDC in your Devnet wallet.');
  console.log('   Get Devnet USDC from: https://faucet.solana.com/\n');

  // For now, just show what needs to be done
  console.log('📋 Manual Steps Required:');
  console.log('1. Get Devnet USDC tokens');
  console.log('2. Create USDC token account if needed');
  console.log('3. Use frontend or CLI to make first deposit');
  console.log('4. Pool will activate automatically');
  
  console.log('\n💡 Alternative: Use the frontend swap interface');
  console.log('   The frontend will handle all the token account setup automatically.');
}

main().catch(console.error);
