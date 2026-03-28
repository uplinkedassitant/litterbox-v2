#!/usr/bin/env node

/**
 * LitterBox v2 - Initialize Program (SOL Version)
 * 
 * Creates:
 * 1. $LITTER token mint
 * 2. Config PDA
 * 3. Pool PDA
 * 4. Initial $LITTER supply (1 billion tokens)
 * 
 * Usage: node scripts/init-program-sol.js
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
  createMintToInstruction,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  getOrCreateAssociatedTokenAccount,
} = require('@solana/spl-token');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Configuration - NEW PROGRAM ID
const PROGRAM_ID = new PublicKey('GZMVhkNjd28Jsj8iUuMKfSg1mPdGuXCeUE3khgxxF7DM');
const CONFIG_SEED = 'config';
const POOL_SEED = 'pool';
const RPC_URL = 'https://api.devnet.solana.com';

async function main() {
  console.log('🐱‍👤 LitterBox v2 - Initialize Program (SOL)\n');
  console.log('═══════════════════════════════════════════\n');
  console.log(`Program ID: ${PROGRAM_ID.toString()}\n`);

  // Load keypair
  const keypairPath = path.join(os.homedir(), '.config/solana/id_litterbox_v2.json');
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
  const authority = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  
  console.log(`Authority: ${authority.publicKey.toString()}`);

  const connection = new Connection(RPC_URL, 'confirmed');

  // Check balance
  const balance = await connection.getBalance(authority.publicKey);
  console.log(`SOL Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);

  if (balance < 0.5 * LAMPORTS_PER_SOL) {
    console.error('❌ Insufficient SOL balance. Need at least 0.5 SOL.');
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
  const mintRent = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);
  
  const createMintAccountIx = SystemProgram.createAccount({
    fromPubkey: authority.publicKey,
    newAccountPubkey: litterMint.publicKey,
    lamports: mintRent,
    space: MINT_SIZE,
    programId: TOKEN_PROGRAM_ID,
  });

  const initMintIx = createInitializeMintInstruction(
    litterMint.publicKey,
    9, // decimals
    authority.publicKey, // mint authority
    authority.publicKey, // freeze authority
    TOKEN_PROGRAM_ID
  );

  const transaction1 = new Transaction().add(createMintAccountIx, initMintIx);
  const { blockhash } = await connection.getLatestBlockhash();
  transaction1.recentBlockhash = blockhash;
  transaction1.feePayer = authority.publicKey;

  console.log('   Creating mint account...');
  const sig1 = await sendAndConfirmTransaction(connection, transaction1, [authority, litterMint], {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  });
  console.log(`   ✅ Mint created: ${litterMint.publicKey.toString()}`);
  console.log(`   Signature: https://explorer.solana.com/tx/${sig1}?cluster=devnet`);

  // Initialize Program (Config + Pool PDAs)
  console.log('\n🏗️  Step 2: Initializing Config and Pool PDAs...');
  
  const initIx = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: authority.publicKey, isSigner: true, isWritable: true },
      { pubkey: configPda, isSigner: false, isWritable: true },
      { pubkey: poolPda, isSigner: false, isWritable: true },
      { pubkey: litterMint.publicKey, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from([0]), // Initialize instruction discriminator
  });

  const transaction2 = new Transaction().add(initIx);
  const { blockhash: blockhash2 } = await connection.getLatestBlockhash();
  transaction2.recentBlockhash = blockhash2;
  transaction2.feePayer = authority.publicKey;

  const sig2 = await sendAndConfirmTransaction(connection, transaction2, [authority], {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  });
  console.log(`   ✅ PDAs initialized`);
  console.log(`   Signature: https://explorer.solana.com/tx/${sig2}?cluster=devnet`);

  // Mint initial supply
  console.log('\n💰 Step 3: Minting initial $LITTER supply (1 billion)...');
  const userLitterAta = await getOrCreateAssociatedTokenAccount(
    connection,
    authority,
    litterMint.publicKey,
    authority.publicKey
  );
  console.log(`   Your $LITTER ATA: ${userLitterAta.address.toString()}`);

  const mintAmount = 1_000_000_000_000_000_000; // 1B tokens with 9 decimals
  const mintIx = createMintToInstruction(
    litterMint.publicKey,
    userLitterAta.address,
    authority.publicKey,
    mintAmount,
    [],
    TOKEN_PROGRAM_ID
  );

  const transaction3 = new Transaction().add(mintIx);
  const { blockhash: blockhash3 } = await connection.getLatestBlockhash();
  transaction3.recentBlockhash = blockhash3;
  transaction3.feePayer = authority.publicKey;

  const sig3 = await sendAndConfirmTransaction(connection, transaction3, [authority], {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  });
  console.log(`   ✅ Minted 1,000,000,000 $LITTER`);
  console.log(`   Signature: https://explorer.solana.com/tx/${sig3}?cluster=devnet`);

  // Verify pool state
  console.log('\n📊 Step 4: Verifying pool state...');
  const poolInfo = await connection.getAccountInfo(poolPda);
  if (poolInfo && poolInfo.data.length === 40) {
    const virtualLitter = poolInfo.data.readBigUInt64LE(0) / 1e12;
    const virtualSol = poolInfo.data.readBigUInt64LE(8) / 1e9;
    const isActive = poolInfo.data[32] === 1;
    console.log(`   Virtual Litter: ${virtualLitter.toLocaleString()}`);
    console.log(`   Virtual SOL: ${virtualSol.toLocaleString()}`);
    console.log(`   Status: ${isActive ? 'Active ✅' : 'Inactive ⏸️ (waiting for first deposit)'}`);
  }

  console.log('\n✅ Initialization complete!');
  console.log('\n📋 Save these addresses:');
  console.log(`   Program ID: ${PROGRAM_ID.toString()}`);
  console.log(`   Config PDA: ${configPda.toString()}`);
  console.log(`   Pool PDA: ${poolPda.toString()}`);
  console.log(`   $LITTER Mint: ${litterMint.publicKey.toString()}`);
  
  console.log('\n📋 Next steps:');
  console.log('   1. Update Vercel environment variables:');
  console.log(`      VITE_PROGRAM_ID=${PROGRAM_ID.toString()}`);
  console.log(`      VITE_CONFIG_PDA=${configPda.toString()}`);
  console.log(`      VITE_POOL_PDA=${poolPda.toString()}`);
  console.log('   2. Update frontend .env file');
  console.log('   3. Test a small SOL deposit to activate the pool!');
  
  // Save to .env file
  const envPath = path.join(__dirname, '../frontend/.env');
  const envContent = `VITE_PROGRAM_ID=${PROGRAM_ID.toString()}
VITE_CONFIG_PDA=${configPda.toString()}
VITE_POOL_PDA=${poolPda.toString()}
VITE_LITTER_MINT=${litterMint.publicKey.toString()}
`;
  fs.writeFileSync(envPath, envContent);
  console.log(`\n💾 Environment variables saved to frontend/.env`);
}

main().catch(console.error);
