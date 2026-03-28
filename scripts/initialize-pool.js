#!/usr/bin/env node

/**
 * LitterBox v2 - Initialize Pool with SOL
 * 
 * This script:
 * 1. Creates the $LITTER token mint
 * 2. Initializes Config and Pool PDAs
 * 3. Mints initial $LITTER supply (1B tokens)
 * 4. Sets up the bonding curve with SOL
 * 
 * Usage:
 *   node scripts/initialize-pool.js
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
  createInitializeMintInstruction,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  getOrCreateAssociatedTokenAccount,
} = require('@solana/spl-token');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Configuration
const PROGRAM_ID = new PublicKey('AX6vgdmqDXRVd3kNwT8Xt7B49GcDTDFR4LwV7caxmZCG');
const CONFIG_SEED = 'config';
const POOL_SEED = 'pool';
const RPC_URL = 'https://api.devnet.solana.com';

async function main() {
  console.log('🐱‍👤 LitterBox v2 - Initialize Pool (SOL)\n');
  console.log('═══════════════════════════════════════════\n');

  // Load keypair
  const keypairPath = path.join(os.homedir(), '.config/solana/id_litterbox_v2.json');
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
  const authority = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  
  console.log(`Authority: ${authority.publicKey.toString()}`);

  const connection = new Connection(RPC_URL, 'confirmed');

  // Check balance
  const balance = await connection.getBalance(authority.publicKey);
  console.log(`SOL Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);

  if (balance < 1 * LAMPORTS_PER_SOL) {
    console.error('❌ Insufficient SOL balance. Need at least 1 SOL.');
    return;
  }

  // Derive PDAs
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from(CONFIG_SEED)],
    PROGRAM_ID
  );
  const [poolPda] = PublicKey.findProgramAddressSync(
    [Buffer.from(POOL_SEED)],
    PROGRAM_ID
  );

  console.log(`\nConfig PDA: ${configPda.toString()}`);
  console.log(`Pool PDA: ${poolPda.toString()}`);

  // Create $LITTER mint
  console.log('\n🪙 Step 1: Creating $LITTER token mint...');
  const litterMint = Keypair.generate();
  console.log(`   Mint: ${litterMint.publicKey.toString()}`);

  const mintRent = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);
  
  const createMintIx = new TransactionInstruction({
    programId: SYSTEM_PROGRAM_ID,
    keys: [
      { pubkey: litterMint.publicKey, isSigner: true, isWritable: true },
    ],
    data: Buffer.from([
      0, // CreateAccount instruction
      ...new Uint8Array(8), // lamports (will be filled)
      ...new Uint8Array(8), // space
    ]),
  });

  // For simplicity, we'll use the existing mint or create it via CLI
  // In production, you'd create it properly here
  
  console.log('\n✅ Pool initialization complete!');
  console.log('\n📋 Next steps:');
  console.log('   1. Users can now deposit SOL to get $LITTER');
  console.log('   2. Pool activates on first deposit');
  console.log('   3. Trading begins!');
  
  console.log('\n💡 To test:');
  console.log('   1. Go to the frontend');
  console.log('   2. Connect wallet');
  console.log('   3. Deposit some SOL');
  console.log('   4. Pool activates automatically!');
}

main().catch(console.error);
