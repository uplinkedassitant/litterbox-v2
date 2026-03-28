#!/usr/bin/env node
/**
 * Create token account owned by Pool PDA
 * This allows the program to transfer tokens using PDA signing
 */
const { Connection, Keypair, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction } = require('@solana/web3.js');
const { createInitializeAccountInstruction, MINT_SIZE, TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PROGRAM_ID = new PublicKey('GZMVhkNjd28Jsj8iUuMKfSg1mPdGuXCeUE3khgxxF7DM');
const LITTER_MINT = new PublicKey('CG33xMCtxfsT8m9WyUhg5uYooY8baC3xYp398254aBP7');
const POOL_SEED = 'pool';
const RPC_URL = 'https://api.devnet.solana.com';

async function main() {
  const keypairPath = path.join(os.homedir(), '.config/solana/id_litterbox_v2.json');
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
  const authority = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  
  const connection = new Connection(RPC_URL, 'confirmed');
  
  // Derive Pool PDA
  const [poolPda] = PublicKey.findProgramAddressSync(
    [Buffer.from(POOL_SEED)],
    PROGRAM_ID
  );
  
  // Derive PDA-owned token account
  const [pdaVault] = PublicKey.findProgramAddressSync(
    [poolPda.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), LITTER_MINT.toBuffer()],
    new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL')
  );
  
  console.log('Creating PDA-owned vault...');
  console.log('  Pool PDA:', poolPda.toString());
  console.log('  PDA Vault:', pdaVault.toString());
  
  // Create the token account
  const space = 165; // Token account size
  const rent = await connection.getMinimumBalanceForRentExemption(space);
  
  const createAccountIx = SystemProgram.createAccount({
    fromPubkey: authority.publicKey,
    newAccountPubkey: pdaVault,
    lamports: rent,
    space: space,
    programId: TOKEN_PROGRAM_ID,
  });
  
  const initAccountIx = createInitializeAccountInstruction(
    pdaVault,
    LITTER_MINT,
    poolPda // Owner is the Pool PDA!
  );
  
  const tx = new Transaction().add(createAccountIx, initAccountIx);
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = authority.publicKey;
  
  await sendAndConfirmTransaction(connection, tx, [authority]);
  
  console.log('✅ PDA Vault created!');
  console.log('   Address:', pdaVault.toString());
  console.log('   Owner: Pool PDA (program-controlled)');
  console.log('\n💡 Now transfer 98% of $Litter supply here:');
  console.log(`   spl-token transfer --owner ~/.config/solana/id_litterbox_v2.json ${LITTER_MINT.toString()} 980000000 ${pdaVault.toString()}`);
  
  // Save to .env
  const envPath = path.join(__dirname, '../frontend/.env');
  let env = fs.readFileSync(envPath, 'utf-8');
  env = env.replace(/VITE_POOL_VAULT=.*/, `VITE_POOL_VAULT=${pdaVault.toString()}`);
  fs.writeFileSync(envPath, env);
  console.log('\n✅ Environment updated!');
}

main().catch(console.error);
