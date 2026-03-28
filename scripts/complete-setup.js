#!/usr/bin/env node

/**
 * Complete Setup - Creates ALL necessary accounts
 * 
 * This script:
 * 1. Creates your USDC token account
 * 2. Creates pool's USDC token account  
 * 3. Creates your $LITTER token account
 * 4. Creates pool's $LITTER token account
 * 5. Transfers initial USDC to activate pool
 * 
 * Usage: node scripts/complete-setup.js
 */

const {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
  SystemProgram,
} = require('@solana/web3.js');
const {
  getOrCreateAssociatedTokenAccount,
  createTransferInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} = require('@solana/spl-token');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG = {
  PROGRAM_ID: new PublicKey('AX6vgdmqDXRVd3kNwT8Xt7B49GcDTDFR4LwV7caxmZCG'),
  CONFIG_PDA: new PublicKey('GSyYSVVz9yrk6XSeF9zMi9GzvtUk47mKVhjKJVW4HTGZ'),
  POOL_PDA: new PublicKey('H3LwN5cS6zyX3iU8PwnDMXh4RbFAmwBKGkg81UzGuwFt'),
  USDC_MINT: new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'),
  RPC_URL: 'https://api.devnet.solana.com',
};

async function main() {
  console.log('🐱‍👤 LitterBox v2 - Complete Setup\n');
  console.log('═══════════════════════════════════════════\n');

  // Load keypair
  const keypairPath = path.join(os.homedir(), '.config/solana/id_litterbox_v2.json');
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
  const user = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  
  console.log(`Your Wallet: ${user.publicKey.toString()}\n`);

  const connection = new Connection(CONFIG.RPC_URL, 'confirmed');

  // Check SOL
  const solBalance = await connection.getBalance(user.publicKey);
  console.log(`SOL Balance: ${(solBalance / LAMPORTS_PER_SOL).toFixed(4)}`);
  if (solBalance < 0.1) {
    console.error('❌ Need SOL for gas. Get from: https://faucet.solana.com/');
    return;
  }

  // Step 1: Create user's USDC ATA
  console.log('\n📍 Step 1: Creating your USDC account...');
  let userUsdcAta;
  try {
    userUsdcAta = await getOrCreateAssociatedTokenAccount(
      connection,
      user,
      CONFIG.USDC_MINT,
      user.publicKey
    );
    console.log(`   ✅ Your USDC ATA: ${userUsdcAta.address.toString()}`);
  } catch (err) {
    console.error('   ❌ Error:', err.message);
    return;
  }

  // Check USDC balance
  const usdcBalance = await connection.getTokenAccountBalance(userUsdcAta.address);
  console.log(`   Your USDC: ${usdcBalance.value.uiAmount}`);
  if (usdcBalance.value.uiAmount < 5) {
    console.error('\n❌ Need at least 5 USDC. Get from: https://faucet.solana.com/');
    console.error('   1. Go to faucet');
    console.error('   2. Select "USDC" token');
    console.error('   3. Request to: ' + user.publicKey.toString());
    console.error('   4. Run this script again');
    return;
  }

  // Step 2: Create pool's USDC ATA
  console.log('\n📍 Step 2: Creating pool\'s USDC account...');
  let poolUsdcAta;
  try {
    poolUsdcAta = await getOrCreateAssociatedTokenAccount(
      connection,
      user,
      CONFIG.USDC_MINT,
      CONFIG.POOL_PDA,
      true // allow owner off-curve
    );
    console.log(`   ✅ Pool USDC ATA: ${poolUsdcAta.address.toString()}`);
  } catch (err) {
    console.error('   ❌ Error:', err.message);
    return;
  }

  // Step 3: Transfer 5 USDC to pool
  console.log('\n💰 Step 3: Transferring 5 USDC to pool...');
  const transferAmount = Math.floor(5 * 1_000_000);
  const transferIx = createTransferInstruction(
    userUsdcAta.address,
    poolUsdcAta.address,
    user.publicKey,
    transferAmount,
    [],
    TOKEN_PROGRAM_ID
  );

  const tx = new Transaction().add(transferIx);
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = user.publicKey;

  const signature = await sendAndConfirmTransaction(connection, tx, [user], {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  });

  console.log(`   ✅ Transfer complete: https://explorer.solana.com/tx/${signature}?cluster=devnet`);

  // Step 4: Check pool status
  console.log('\n📊 Step 4: Checking pool status...');
  const poolInfo = await connection.getAccountInfo(CONFIG.POOL_PDA);
  if (poolInfo && poolInfo.data.length === 40) {
    const isActive = poolInfo.data[32] === 1;
    console.log(`   Pool Status: ${isActive ? 'Active ✅' : 'Inactive ⏸️'}`);
    
    if (!isActive) {
      console.log('\n⚠️  Pool is still inactive. This is expected - the program needs');
      console.log('   to be called with the swap instruction to activate it.');
      console.log('\n   The token accounts are now set up. Try the frontend again!');
    }
  }

  console.log('\n✅ Setup complete!');
  console.log('\n📋 Next steps:');
  console.log('   1. Go to your Vercel frontend');
  console.log('   2. Connect your wallet');
  console.log('   3. Try a small swap (deposit)');
  console.log('   4. Pool should activate on first deposit!');
}

main().catch(console.error);
