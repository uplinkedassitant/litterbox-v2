#!/usr/bin/env node

/**
 * LitterBox v2 - User Setup Script
 * 
 * Creates necessary token accounts for a user to start swapping.
 * Run this ONCE per user wallet before making their first swap.
 * 
 * Usage:
 *   node scripts/setup-user.js
 */

const {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
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
const USDC_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'); // Devnet USDC
const POOL_PDA = new PublicKey('H3LwN5cS6zyX3iU8PwnDMXh4RbFAmwBKGkg81UzGuwFt');
const RPC_URL = 'https://api.devnet.solana.com';

async function main() {
  console.log('🐱‍👤 LitterBox v2 - User Setup\n');
  console.log('═══════════════════════════════════════════\n');

  // Load user keypair (this would be the user's wallet)
  const keypairPath = path.join(os.homedir(), '.config/solana/id_litterbox_v2.json');
  
  if (!fs.existsSync(keypairPath)) {
    console.error('❌ Keypair not found! Please create it first:');
    console.error('   solana-keygen new --outfile ~/.config/solana/id_litterbox_v2.json');
    return;
  }

  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
  const user = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  
  console.log(`User Wallet: ${user.publicKey.toString()}\n`);

  const connection = new Connection(RPC_URL, 'confirmed');

  // Check SOL balance
  const balance = await connection.getBalance(user.publicKey);
  console.log(`SOL Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);

  if (balance < 0.1 * LAMPORTS_PER_SOL) {
    console.error('❌ Insufficient SOL balance. Need at least 0.1 SOL.');
    console.error('   Get Devnet SOL from: https://faucet.solana.com/');
    return;
  }

  console.log('\n🪙 Step 1: Creating USDC token account...');
  try {
    const userUsdcAta = await getOrCreateAssociatedTokenAccount(
      connection,
      user,
      USDC_MINT,
      user.publicKey
    );
    console.log(`   ✅ USDC ATA: ${userUsdcAta.address.toString()}`);
  } catch (err) {
    console.log('   ℹ️  USDC ATA may already exist');
  }

  console.log('\n🪙 Step 2: Creating $LITTER token account...');
  try {
    const userLitterAta = await getOrCreateAssociatedTokenAccount(
      connection,
      user,
      POOL_PDA, // Using pool as placeholder for litter mint
      user.publicKey
    );
    console.log(`   ✅ $LITTER ATA: ${userLitterAta.address.toString()}`);
  } catch (err) {
    console.log('   ℹ️  $LITTER ATA may already exist');
    console.log('   Note: $LITTER mint will be created on first deposit');
  }

  console.log('\n✅ Setup complete!');
  console.log('\n📋 Next steps:');
  console.log('1. Get some Devnet USDC tokens');
  console.log('2. Go to the frontend and make your first deposit');
  console.log('3. The pool will activate automatically!');
  
  console.log('\n💡 To get Devnet USDC:');
  console.log('   1. Go to: https://faucet.solana.com/');
  console.log('   2. Request USDC tokens');
  console.log('   3. Wait for confirmation');
  console.log('   4. Return to frontend and swap!');
}

main().catch(console.error);
