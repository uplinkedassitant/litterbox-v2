#!/usr/bin/env node

/**
 * LitterBox v2 - First Deposit Script
 * 
 * Makes the actual first deposit to activate the pool.
 * This creates token accounts and calls the swap instruction.
 * 
 * Usage:
 *   node scripts/do-first-deposit.js [amount]
 *   Default: 5 USDC
 */

const {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
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
const { Buffer } = require('buffer');

// Configuration
const PROGRAM_ID = new PublicKey('AX6vgdmqDXRVd3kNwT8Xt7B49GcDTDFR4LwV7caxmZCG');
const CONFIG_PDA = new PublicKey('GSyYSVVz9yrk6XSeF9zMi9GzvtUk47mKVhjKJVW4HTGZ');
const POOL_PDA = new PublicKey('H3LwN5cS6zyX3iU8PwnDMXh4RbFAmwBKGkg81UzGuwFt');
const USDC_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
const RPC_URL = 'https://api.devnet.solana.com';

async function main() {
  console.log('🐱‍👤 LitterBox v2 - First Deposit\n');
  console.log('═══════════════════════════════════════════\n');

  const amount = parseFloat(process.argv[2] || '5');
  console.log(`Amount: ${amount} USDC\n`);

  // Load keypair
  const keypairPath = path.join(os.homedir(), '.config/solana/id_litterbox_v2.json');
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
  const authority = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  
  console.log(`Authority: ${authority.publicKey.toString()}`);

  const connection = new Connection(RPC_URL, 'confirmed');

  // Check SOL balance
  const solBalance = await connection.getBalance(authority.publicKey);
  console.log(`SOL Balance: ${(solBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);

  if (solBalance < 0.1 * LAMPORTS_PER_SOL) {
    console.error('❌ Insufficient SOL balance for gas fees');
    return;
  }

  // Check pool status
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

  console.log('\n🪙 Step 1: Creating/getting USDC token account...');
  let userUsdcAta;
  try {
    userUsdcAta = await getOrCreateAssociatedTokenAccount(
      connection,
      authority,
      USDC_MINT,
      authority.publicKey
    );
    console.log(`   ✅ USDC ATA: ${userUsdcAta.address.toString()}`);
    
    // Check USDC balance
    const usdcBalance = await connection.getTokenAccountBalance(userUsdcAta.address);
    console.log(`   USDC Balance: ${usdcBalance.value.uiAmount}`);
    
    if (usdcBalance.value.uiAmount < amount) {
      console.error(`\n❌ Insufficient USDC balance. Have: ${usdcBalance.value.uiAmount}, Need: ${amount}`);
      console.error('\n💡 To get Devnet USDC:');
      console.error('   1. Go to: https://faucet.solana.com/');
      console.error('   2. Request USDC tokens');
      console.error('   3. Run this script again');
      return;
    }
  } catch (err) {
    console.error('   ❌ Error creating USDC ATA:', err.message);
    return;
  }

  console.log('\n🪙 Step 2: Creating $LITTER token account...');
  let userLitterAta;
  try {
    // We need the actual LITTER mint address - for now use pool as placeholder
    // In production, this would come from the pool initialization
    userLitterAta = await getOrCreateAssociatedTokenAccount(
      connection,
      authority,
      POOL_PDA, // Placeholder - should be actual LITTER mint
      authority.publicKey
    );
    console.log(`   ✅ $LITTER ATA: ${userLitterAta.address.toString()}`);
  } catch (err) {
    console.error('   ℹ️  $LITTER ATA creation skipped (mint not available yet)');
  }

  console.log('\n💰 Step 3: Making first deposit...');
  console.log(`   Amount: ${amount} USDC`);
  console.log(`   Expected $Litter: ~${(amount * 0.98).toFixed(6)} (after 2% fee)`);

  // Create instruction data for swap
  const data = Buffer.alloc(9);
  data[0] = 1; // discriminator for swap
  data.writeBigUInt64LE(BigInt(Math.floor(amount * 1_000_000)), 1);

  // Create pool's USDC ATA
  const poolUsdcAta = await getOrCreateAssociatedTokenAccount(
    connection,
    authority,
    USDC_MINT,
    POOL_PDA
  );

  const instruction = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: authority.publicKey, isSigner: true, isWritable: true },
      { pubkey: CONFIG_PDA, isSigner: false, isWritable: true },
      { pubkey: POOL_PDA, isSigner: false, isWritable: true },
      { pubkey: userUsdcAta.address, isSigner: false, isWritable: true },
      { pubkey: poolUsdcAta.address, isSigner: false, isWritable: true },
      { pubkey: userLitterAta ? userLitterAta.address : authority.publicKey, isSigner: false, isWritable: true },
      { pubkey: POOL_PDA, isSigner: false, isWritable: false }, // litter_mint placeholder
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: data,
  });

  const transaction = new Transaction().add(instruction);
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = authority.publicKey;

  console.log('\n📡 Sending transaction...');
  try {
    const signature = await sendAndConfirmTransaction(connection, transaction, [authority], {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    console.log('\n✅ First deposit successful!');
    console.log(`   Transaction: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    console.log('\n🎉 Pool is now ACTIVE!');
    console.log('\n📋 Next steps:');
    console.log('   1. Go to the frontend');
    console.log('   2. Connect your wallet');
    console.log('   3. Pool stats should show "Active"');
    console.log('   4. Start swapping!');
  } catch (err) {
    console.error('\n❌ Transaction failed:', err.message);
    console.error('\n💡 This is expected if:');
    console.error('   - Token accounts are not set up correctly');
    console.error('   - The program expects different account structure');
    console.error('   - Insufficient USDC balance');
    console.error('\nCheck the error above for details.');
  }
}

main().catch(console.error);
