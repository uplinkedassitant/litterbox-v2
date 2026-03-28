#!/usr/bin/env node

/**
 * LitterBox v2 - Simple Pool Activation
 * 
 * Just transfers 5 USDC to the pool's USDC account.
 * This is the simplest way to activate the pool.
 * 
 * Usage:
 *   node scripts/simple-activate.js [amount]
 */

const {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
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

// Configuration
const USDC_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
const POOL_PDA = new PublicKey('H3LwN5cS6zyX3iU8PwnDMXh4RbFAmwBKGkg81UzGuwFt');
const RPC_URL = 'https://api.devnet.solana.com';

async function main() {
  console.log('🐱‍👤 LitterBox v2 - Simple Pool Activation\n');
  console.log('═══════════════════════════════════════════\n');

  const amount = parseFloat(process.argv[2] || '5');
  console.log(`Activating pool with: ${amount} USDC\n`);

  // Load keypair
  const keypairPath = path.join(os.homedir(), '.config/solana/id_litterbox_v2.json');
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
  const user = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  
  console.log(`From: ${user.publicKey.toString()}`);
  console.log(`To Pool: ${POOL_PDA.toString()}\n`);

  const connection = new Connection(RPC_URL, 'confirmed');

  // Check SOL balance
  const solBalance = await connection.getBalance(user.publicKey);
  console.log(`SOL Balance: ${(solBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);

  if (solBalance < 0.01 * LAMPORTS_PER_SOL) {
    console.error('❌ Insufficient SOL for gas fees');
    return;
  }

  // Get user's USDC ATA
  console.log('\n📍 Step 1: Getting your USDC account...');
  const userUsdcAta = await getOrCreateAssociatedTokenAccount(
    connection,
    user,
    USDC_MINT,
    user.publicKey
  );
  console.log(`   Your USDC ATA: ${userUsdcAta.address.toString()}`);

  // Check USDC balance
  const usdcBalance = await connection.getTokenAccountBalance(userUsdcAta.address);
  console.log(`   Your USDC Balance: ${usdcBalance.value.uiAmount}`);
  
  if (usdcBalance.value.uiAmount < amount) {
    console.error(`\n❌ Insufficient USDC. Have: ${usdcBalance.value.uiAmount}, Need: ${amount}`);
    console.error('\n💡 Get Devnet USDC: https://faucet.solana.com/');
    return;
  }

  // Get pool's USDC ATA
  console.log('\n📍 Step 2: Getting pool\'s USDC account...');
  const poolUsdcAta = await getAssociatedTokenAddress(
    POOL_PDA,
    USDC_MINT
  );
  console.log(`   Pool USDC ATA: ${poolUsdcAta.toString()}`);

  // Create transfer instruction
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

  console.log('\n📡 Sending transaction...');
  const signature = await sendAndConfirmTransaction(connection, transaction, [user], {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  });

  console.log('\n✅ SUCCESS! Pool activated!');
  console.log(`   Transaction: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
  console.log('\n🎉 The pool is now ACTIVE and ready for swapping!');
  console.log('\n📋 Next steps:');
  console.log('   1. Go to your Vercel frontend');
  console.log('   2. Connect wallet');
  console.log('   3. Pool stats should show "Active ✅"');
  console.log('   4. Start swapping!');
}

main().catch(console.error);
