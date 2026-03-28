#!/usr/bin/env node

/**
 * Manual Pool Activation
 * 
 * 1. Creates pool's USDC token account (if needed)
 * 2. Transfers USDC from your wallet to pool
 * 3. Activates the pool
 * 
 * Usage: node scripts/manual-activate.js
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
  createTransferInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} = require('@solana/spl-token');
const fs = require('fs');
const path = require('path');
const os = require('os');

const USDC_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
const POOL_PDA = new PublicKey('H3LwN5cS6zyX3iU8PwnDMXh4RbFAmwBKGkg81UzGuwFt');
const RPC_URL = 'https://api.devnet.solana.com';

async function main() {
  console.log('🐱‍👤 Manual Pool Activation\n');
  
  // Load keypair
  const keypairPath = path.join(os.homedir(), '.config/solana/id_litterbox_v2.json');
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
  const user = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  
  console.log(`Your Wallet: ${user.publicKey.toString()}`);
  console.log(`Pool PDA: ${POOL_PDA.toString()}\n`);

  const connection = new Connection(RPC_URL, 'confirmed');

  // Check SOL
  const solBalance = await connection.getBalance(user.publicKey);
  console.log(`Your SOL: ${(solBalance / LAMPORTS_PER_SOL).toFixed(4)}`);
  
  if (solBalance < 0.01 * LAMPORTS_PER_SOL) {
    console.error('❌ Need SOL for gas fees. Get from: https://faucet.solana.com/');
    return;
  }

  // Get user's USDC ATA
  console.log('\n📍 Step 1: Getting your USDC account...');
  let userUsdcAta;
  try {
    userUsdcAta = await getOrCreateAssociatedTokenAccount(
      connection,
      user,
      USDC_MINT,
      user.publicKey
    );
    console.log(`   ✅ Your USDC ATA: ${userUsdcAta.address.toString()}`);
  } catch (err) {
    console.error('   ❌ Error:', err.message);
    console.error('\n💡 You need USDC tokens first!');
    console.error('   1. Go to: https://faucet.solana.com/');
    console.error('   2. Select "USDC" token');
    console.error('   3. Request tokens to: ' + user.publicKey.toString());
    console.error('   4. Run this script again');
    return;
  }

  // Check USDC balance
  const usdcBalance = await connection.getTokenAccountBalance(userUsdcAta.address);
  console.log(`   Your USDC: ${usdcBalance.value.uiAmount}`);
  
  if (usdcBalance.value.uiAmount < 5) {
    console.error('\n❌ Insufficient USDC. Need at least 5 USDC.');
    console.error('   Get Devnet USDC from: https://faucet.solana.com/');
    return;
  }

  // Create pool's USDC ATA
  console.log('\n📍 Step 2: Creating pool\'s USDC account...');
  const poolUsdcAta = await getAssociatedTokenAddress(POOL_PDA, USDC_MINT);
  console.log(`   Pool USDC ATA: ${poolUsdcAta.toString()}`);
  
  // Check if pool's ATA exists
  let poolAtaInfo = await connection.getAccountInfo(poolUsdcAta);
  if (!poolAtaInfo) {
    console.log('   Creating pool USDC ATA (needs SOL for rent)...');
    // Create the ATA by doing a minimal transfer
    await getOrCreateAssociatedTokenAccount(
      connection,
      user,
      USDC_MINT,
      POOL_PDA,
      true // allow owner off-curve (PDAs are off-curve)
    );
    console.log('   ✅ Pool USDC ATA created');
  } else {
    console.log('   ✅ Pool USDC ATA already exists');
  }

  // Transfer 5 USDC to pool
  const amount = 5;
  console.log(`\n💰 Step 3: Transferring ${amount} USDC to pool...`);
  const transferAmount = Math.floor(amount * 1_000_000); // 6 decimals
  
  const transferIx = createTransferInstruction(
    userUsdcAta.address,
    poolUsdcAta,
    user.publicKey,
    transferAmount,
    [],
    TOKEN_PROGRAM_ID
  );

  const transaction = new Transaction().add(transferIx);
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = user.publicKey;

  console.log('   Sending...');
  const signature = await sendAndConfirmTransaction(connection, transaction, [user], {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  });

  console.log('\n✅ SUCCESS!');
  console.log(`   Transaction: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
  console.log('\n🎉 Pool should now be ACTIVE!');
  console.log('\n📋 Next: Go to frontend and refresh - pool stats should show "Active ✅"');
}

main().catch(console.error);
