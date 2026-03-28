/**
 * Initialize LitterBox v2 Program
 * 
 * This script:
 * 1. Deploys the program (if not already deployed)
 * 2. Creates the $LITTER mint
 * 3. Calls initialize instruction
 * 4. Verifies the setup
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  createInitializeMintInstruction,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  getMinimumBalanceForRentExemptMint,
} from '@spl-token';
import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

// Configuration
const PROGRAM_ID = new PublicKey('CyuzmNggCxLyupt8JBdMdisRn5yo1eUfBPne9BqTnt85');
const RPC_URL = 'https://api.devnet.solana.com';

// Seeds
const CONFIG_SEED = 'config';
const POOL_SEED = 'pool';

// Token config
const DECIMALS = 6;
const TOTAL_SUPPLY = 1_000_000_000_000_000n; // 1B with 6 decimals
const INITIAL_VIRTUAL_LITTER = 1_000_000_000_000n; // 1000 LITTER
const INITIAL_VIRTUAL_USDC = 1_000_000_000n; // 1000 USDC
const FEE_BPS = 200n; // 2%

async function main() {
  console.log('🐱‍👤 LitterBox v2 Initialization\n');

  // Load keypair
  const keypairPath = join(homedir(), '.config/solana/id_litterbox_v2.json');
  const keypairData = JSON.parse(readFileSync(keypairPath, 'utf-8'));
  const authority = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  
  console.log('Authority:', authority.publicKey.toString());
  console.log('Program ID:', PROGRAM_ID.toString());

  const connection = new Connection(RPC_URL, 'confirmed');

  // Derive PDAs
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from(CONFIG_SEED)],
    PROGRAM_ID
  );
  
  const [poolPda] = PublicKey.findProgramAddressSync(
    [Buffer.from(POOL_SEED)],
    PROGRAM_ID
  );

  console.log('\n📍 PDAs:');
  console.log('  Config:', configPda.toString());
  console.log('  Pool:', poolPda.toString());

  // Check if already initialized
  const configInfo = await connection.getAccountInfo(configPda);
  if (configInfo) {
    console.log('\n✅ Config account already exists!');
    console.log('Program may already be initialized.');
    return;
  }

  // Create $LITTER mint
  console.log('\n🪙 Creating $LITTER mint...');
  const litterMint = Keypair.generate();
  console.log('Mint address:', litterMint.publicKey.toString());

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
      authority.publicKey, // Mint authority
      authority.publicKey, // Freeze authority
      TOKEN_PROGRAM_ID
    )
  );

  mintTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  mintTx.feePayer = authority.publicKey;

  console.log('Sending mint creation transaction...');
  await sendAndConfirmTransaction(connection, mintTx, [authority, litterMint], {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  });

  console.log('✅ Mint created successfully!');

  // Call initialize instruction
  console.log('\n🔧 Calling initialize instruction...');
  
  const initializeIx = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: authority.publicKey, isSigner: true, isWritable: true },
      { pubkey: configPda, isSigner: false, isWritable: true },
      { pubkey: poolPda, isSigner: false, isWritable: true },
      { pubkey: litterMint.publicKey, isSigner: false, isWritable: true },
    ],
    data: Buffer.from([0]), // Discriminator for initialize
  });

  const tx = new Transaction().add(initializeIx);
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.feePayer = authority.publicKey;

  console.log('Sending initialize transaction...');
  const signature = await sendAndConfirmTransaction(connection, tx, [authority], {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  });

  console.log('✅ Program initialized!');
  console.log('Transaction:', `https://explorer.solana.com/tx/${signature}?cluster=devnet`);

  // Verify
  console.log('\n🔍 Verifying setup...');
  
  const configData = await connection.getAccountInfo(configPda);
  if (configData) {
    console.log('✅ Config account created');
    console.log('   Size:', configData.data.length, 'bytes');
    console.log('   Owner:', configData.owner.toString());
  }

  const poolData = await connection.getAccountInfo(poolPda);
  if (poolData) {
    console.log('✅ Pool account created');
    console.log('   Size:', poolData.data.length, 'bytes');
  }

  console.log('\n🎉 Initialization complete!');
  console.log('\nNext steps:');
  console.log('1. Add liquidity to the pool (first swap)');
  console.log('2. Test swap functionality');
  console.log('3. Deploy frontend');
}

main().catch(console.error);
