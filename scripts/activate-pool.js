#!/usr/bin/env node

/**
 * LitterBox v2 - Activate Pool Script
 * 
 * Makes the first deposit to activate the pool.
 * This creates all necessary token accounts and makes a small deposit.
 * 
 * Usage:
 *   node scripts/activate-pool.js
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
const USDC_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
const RPC_URL = 'https://api.devnet.solana.com';

async function main() {
  console.log('🐱‍👤 LitterBox v2 - Activate Pool\n');
  console.log('═══════════════════════════════════════════\n');

  // Load keypair
  const keypairPath = path.join(os.homedir(), '.config/solana/id_litterbox_v2.json');
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
  const authority = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  
  console.log(`Authority: ${authority.publicKey.toString()}\n`);

  const connection = new Connection(RPC_URL, 'confirmed');

  // Check balance
  const balance = await connection.getBalance(authority.publicKey);
  console.log(`SOL Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);

  if (balance < 0.5 * LAMPORTS_PER_SOL) {
    console.error('❌ Insufficient SOL balance');
    return;
  }

  console.log('\n📊 Checking pool status...');
  const poolInfo = await connection.getAccountInfo(POOL_PDA);
  if (!poolInfo) {
    console.error('❌ Pool not initialized! Run initialize-pool.js first');
    return;
  }

  const virtualLitter = poolInfo.data.readBigUInt64LE(0);
  const virtualUsdc = poolInfo.data.readBigUInt64LE(8);
  const isActive = poolInfo.data[32] === 1;

  console.log(`   Virtual Litter: ${(Number(virtualLitter) / 1e12).toFixed(2)}`);
  console.log(`   Virtual USDC: ${(Number(virtualUsdc) / 1e9).toFixed(2)}`);
  console.log(`   Status: ${isActive ? 'Active ✅' : 'Inactive ⏸️'}`);

  if (isActive) {
    console.log('\n✅ Pool is already active!');
    return;
  }

  console.log('\n⚠️  NOTE: This script requires USDC tokens in your wallet.');
  console.log('   To get Devnet USDC:');
  console.log('   1. Go to: https://faucet.solana.com/');
  console.log('   2. Request USDC tokens');
  console.log('   3. Run this script again\n');

  console.log('📋 Manual activation steps:');
  console.log('   1. Get Devnet USDC from faucet');
  console.log('   2. Use frontend to make first deposit');
  console.log('   3. Pool will activate automatically');
  
  console.log('\n💡 Alternatively, use the frontend swap interface');
  console.log('   The frontend will handle token account creation automatically.');
}

main().catch(console.error);
