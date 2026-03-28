/**
 * Initialize LitterBox v2 Pool
 * 
 * This script:
 * 1. Creates $LITTER mint
 * 2. Calls initialize instruction
 * 3. Verifies setup
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
const PROGRAM_ID = new PublicKey('AX6vgdmqDXRVd3kNwT8Xt7B49GcDTDFR4LwV7caxmZCG');
const RPC_URL = 'https://api.devnet.solana.com';

// Seeds
const CONFIG_SEED = 'config';
const POOL_SEED = 'pool';

// Token config
const DECIMALS = 6;

async function main() {
  console.log('🐱‍👤 LitterBox v2 - Initialize Pool\n');
  console.log('Program ID:', PROGRAM_ID.toString());
  console.log('Network:', RPC_URL);

  // Load keypair
  const keypairPath = path.join(os.homedir(), '.config/solana/id_litterbox_v2.json');
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
  const authority = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  
  console.log('Authority:', authority.publicKey.toString());

  const connection = new Connection(RPC_URL, 'confirmed');

  // Check balance
  const balance = await connection.getBalance(authority.publicKey);
  console.log('Balance:', (balance / LAMPORTS_PER_SOL).toFixed(4), 'SOL\n');

  if (balance < 0.1 * LAMPORTS_PER_SOL) {
    console.error('❌ Insufficient SOL balance. Need at least 0.1 SOL for deployment.');
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

  console.log('📍 PDAs:');
  console.log('  Config:', configPda.toString());
  console.log('  Pool:', poolPda.toString());

  // Check if already initialized
  const configInfo = await connection.getAccountInfo(configPda);
  if (configInfo) {
    console.log('\n✅ Config account already exists!');
    console.log('Program may already be initialized.');
    
    // Show current state
    const poolInfo = await connection.getAccountInfo(poolPda);
    if (poolInfo) {
      console.log('Pool account exists. Ready to test swaps!');
      if (poolInfo.data.length === 40) {
        const virtualLitter = poolInfo.data.readBigUInt64LE(0);
        const virtualUsdc = poolInfo.data.readBigUInt64LE(8);
        const isActive = poolInfo.data[32];
        console.log(`   Virtual Litter: ${(Number(virtualLitter) / 1e12).toFixed(2)}`);
        console.log(`   Virtual USDC: ${(Number(virtualUsdc) / 1e9).toFixed(2)}`);
        console.log(`   Active: ${isActive ? 'Yes ✅' : 'No ⏸️'}`);
      }
    }
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
  }

  const poolData = await connection.getAccountInfo(poolPda);
  if (poolData) {
    console.log('✅ Pool account created');
    console.log('   Size:', poolData.data.length, 'bytes');
    
    if (poolData.data.length === 40) {
      const virtualLitter = poolData.data.readBigUInt64LE(0);
      const virtualUsdc = poolData.data.readBigUInt64LE(8);
      const realLitter = poolData.data.readBigUInt64LE(16);
      const realUsdc = poolData.data.readBigUInt64LE(24);
      const isActive = poolData.data[32];
      
      console.log('\n📊 Initial Pool State:');
      console.log(`   Virtual Litter: ${(Number(virtualLitter) / 1e12).toFixed(2)}`);
      console.log(`   Virtual USDC: ${(Number(virtualUsdc) / 1e9).toFixed(2)}`);
      console.log(`   Real Litter: ${(Number(realLitter) / 1e12).toFixed(2)}`);
      console.log(`   Real USDC: ${(Number(realUsdc) / 1e9).toFixed(2)}`);
      console.log(`   Active: ${isActive ? 'Yes ✅' : 'No ⏸️'}`);
    }
  }

  console.log('\n🎉 Initialization complete!');
  console.log('\nNext steps:');
  console.log('1. Update frontend .env with PDA addresses');
  console.log('2. Deploy frontend to Vercel');
  console.log('3. Test swap functionality');
}

main().catch(console.error);
