#!/usr/bin/env node

/**
 * LitterBox v2 - Pool Initialization Script
 * 
 * This script initializes the liquidity pool on any Solana network.
 * Run this ONCE after deploying the program.
 * 
 * Usage:
 *   node scripts/initialize-pool.js
 * 
 * Requirements:
 *   - Solana CLI installed
 *   - Keypair at ~/.config/solana/id_litterbox_v2.json
 *   - Minimum 0.5 SOL balance
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
  getMinimumBalanceForRentExemptMint,
} = require('@solana/spl-token');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Configuration
const CONFIG = {
  devnet: {
    rpc: 'https://api.devnet.solana.com',
    programId: 'AX6vgdmqDXRVd3kNwT8Xt7B49GcDTDFR4LwV7caxmZCG',
  },
  mainnet: {
    rpc: 'https://api.mainnet-beta.solana.com',
    programId: 'TODO_UPDATE_ON_MAINNET_DEPLOY',
  },
};

// Seeds
const CONFIG_SEED = 'config';
const POOL_SEED = 'pool';

// Token configuration
const DECIMALS = 6;
const TOTAL_SUPPLY = 1_000_000_000_000_000n; // 1B with 6 decimals

async function main() {
  console.log('🐱‍👤 LitterBox v2 - Pool Initialization\n');
  console.log('═══════════════════════════════════════════\n');

  // Detect network from Solana CLI config
  const network = process.env.NETWORK || 'devnet';
  const config = CONFIG[network];
  
  if (!config) {
    console.error(`❌ Unknown network: ${network}`);
    return;
  }

  console.log(`Network: ${network.toUpperCase()}`);
  console.log(`Program ID: ${config.programId}`);
  console.log(`RPC: ${config.rpc}\n`);

  // Load keypair
  const keypairPath = path.join(os.homedir(), '.config/solana/id_litterbox_v2.json');
  
  if (!fs.existsSync(keypairPath)) {
    console.error('❌ Keypair not found! Please create it first:');
    console.error('   solana-keygen new --outfile ~/.config/solana/id_litterbox_v2.json\n');
    return;
  }

  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
  const authority = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  
  console.log(`Authority: ${authority.publicKey.toString()}\n`);

  const connection = new Connection(config.rpc, 'confirmed');

  // Check balance
  const balance = await connection.getBalance(authority.publicKey);
  console.log(`Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);

  if (balance < 0.5 * LAMPORTS_PER_SOL) {
    console.error('❌ Insufficient SOL balance. Need at least 0.5 SOL for initialization.');
    console.error('   Transfer SOL to:', authority.publicKey.toString());
    return;
  }

  // Derive PDAs
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from(CONFIG_SEED)],
    new PublicKey(config.programId)
  );
  
  const [poolPda] = PublicKey.findProgramAddressSync(
    [Buffer.from(POOL_SEED)],
    new PublicKey(config.programId)
  );

  console.log('\n📍 PDAs:');
  console.log(`   Config: ${configPda.toString()}`);
  console.log(`   Pool: ${poolPda.toString()}`);

  // Check if already initialized
  const configInfo = await connection.getAccountInfo(configPda);
  if (configInfo) {
    console.log('\n✅ Pool already initialized!');
    console.log('   Config account exists.');
    
    const poolInfo = await connection.getAccountInfo(poolPda);
    if (poolInfo && poolInfo.data.length === 40) {
      const virtualLitter = poolInfo.data.readBigUInt64LE(0);
      const virtualUsdc = poolInfo.data.readBigUInt64LE(8);
      const isActive = poolInfo.data[32];
      
      console.log(`   Virtual Litter: ${(Number(virtualLitter) / 1e12).toFixed(2)}`);
      console.log(`   Virtual USDC: ${(Number(virtualUsdc) / 1e9).toFixed(2)}`);
      console.log(`   Active: ${isActive ? 'Yes ✅' : 'No ⏸️'}`);
    }
    
    console.log('\n✅ Ready to swap!');
    return;
  }

  console.log('\n🪙 Step 1: Creating $LITTER mint...');
  const litterMint = Keypair.generate();
  console.log(`   Mint address: ${litterMint.publicKey.toString()}`);

  const mintRent = await getMinimumBalanceForRentExemptMint(connection);
  
  const mintTx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: authority.publicKey,
      lamports: mintRent,
      newAccountPubkey: litterMint.publicKey,
      programId: TOKEN_PROGRAM_ID,
      space: MINT_SIZE,
    }),
    createInitializeMintInstruction(
      litterMint.publicKey,
      DECIMALS,
      authority.publicKey,
      authority.publicKey,
      TOKEN_PROGRAM_ID
    )
  );

  mintTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  mintTx.feePayer = authority.publicKey;

  console.log('   Sending mint creation transaction...');
  await sendAndConfirmTransaction(connection, mintTx, [authority, litterMint], {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  });

  console.log('   ✅ Mint created successfully!');

  // Call initialize instruction
  console.log('\n🔧 Step 2: Calling initialize instruction...');
  
  const initializeIx = new TransactionInstruction({
    programId: new PublicKey(config.programId),
    keys: [
      { pubkey: authority.publicKey, isSigner: true, isWritable: true },
      { pubkey: configPda, isSigner: false, isWritable: true },
      { pubkey: poolPda, isSigner: false, isWritable: true },
      { pubkey: litterMint.publicKey, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from([0]), // Discriminator for initialize
  });

  const tx = new Transaction().add(initializeIx);
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.feePayer = authority.publicKey;

  console.log('   Sending initialize transaction...');
  const signature = await sendAndConfirmTransaction(connection, tx, [authority], {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  });

  console.log('\n✅ Pool initialized successfully!');
  console.log(`   Transaction: https://explorer.solana.com/tx/${signature}?cluster=${network}`);

  // Verify
  console.log('\n🔍 Verifying setup...');
  
  const configData = await connection.getAccountInfo(configPda);
  if (configData) {
    console.log('   ✅ Config account created');
  }

  const poolData = await connection.getAccountInfo(poolPda);
  if (poolData && poolData.data.length === 40) {
    const virtualLitter = poolData.data.readBigUInt64LE(0);
    const virtualUsdc = poolData.data.readBigUInt64LE(8);
    const isActive = poolData.data[32];
    
    console.log('   ✅ Pool account created');
    console.log(`   Virtual Litter: ${(Number(virtualLitter) / 1e12).toFixed(2)}`);
    console.log(`   Virtual USDC: ${(Number(virtualUsdc) / 1e9).toFixed(2)}`);
    console.log(`   Active: ${isActive ? 'Yes ✅' : 'No ⏸️'}`);
  }

  console.log('\n🎉 Initialization complete!');
  console.log('\n📝 Save these addresses:');
  console.log(`   Program ID: ${config.programId}`);
  console.log(`   Config PDA: ${configPda.toString()}`);
  console.log(`   Pool PDA: ${poolPda.toString()}`);
  console.log(`   Litter Mint: ${litterMint.publicKey.toString()}`);
  
  console.log('\n📋 Next steps:');
  console.log('   1. Update frontend .env with PDA addresses');
  console.log('   2. Deploy frontend to Vercel');
  console.log('   3. Test swap functionality');
  console.log('   4. Monitor pool activity');
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
