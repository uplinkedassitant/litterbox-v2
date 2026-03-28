#!/usr/bin/env node
/**
 * Simple initialization - pump.fun style
 * 1. Create mint
 * 2. Mint 1B tokens to authority
 * 3. Create pool vault ATA (owned by authority)
 * 4. Transfer 98% to vault
 */
const { Connection, Keypair, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { createInitializeMintInstruction, createMintToInstruction, MINT_SIZE, TOKEN_PROGRAM_ID, getOrCreateAssociatedTokenAccount, createTransferInstruction } = require('@solana/spl-token');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PROGRAM_ID = new PublicKey('GZMVhkNjd28Jsj8iUuMKfSg1mPdGuXCeUE3khgxxF7DM');
const RPC_URL = 'https://api.devnet.solana.com';

async function main() {
  console.log('🐱 LitterBox v2 - Simple Init (pump.fun style)\n');
  
  const keypairPath = path.join(os.homedir(), '.config/solana/id_litterbox_v2.json');
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
  const authority = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  
  console.log('Authority:', authority.publicKey.toString());
  
  const connection = new Connection(RPC_URL, 'confirmed');
  
  const balance = await connection.getBalance(authority.publicKey);
  console.log('SOL Balance:', (balance / LAMPORTS_PER_SOL).toFixed(4));
  
  if (balance < 0.5 * LAMPORTS_PER_SOL) {
    console.error('❌ Need more SOL');
    return;
  }
  
  // Step 1: Create mint
  console.log('\n1️⃣ Creating $Litter mint...');
  const mint = Keypair.generate();
  const mintRent = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);
  
  const createMintIx = SystemProgram.createAccount({
    fromPubkey: authority.publicKey,
    newAccountPubkey: mint.publicKey,
    lamports: mintRent,
    space: MINT_SIZE,
    programId: TOKEN_PROGRAM_ID,
  });
  
  const initMintIx = createInitializeMintInstruction(
    mint.publicKey,
    9,
    authority.publicKey,
    authority.publicKey
  );
  
  const tx1 = new Transaction().add(createMintIx, initMintIx);
  const { blockhash } = await connection.getLatestBlockhash();
  tx1.recentBlockhash = blockhash;
  tx1.feePayer = authority.publicKey;
  
  await sendAndConfirmTransaction(connection, tx1, [authority, mint]);
  console.log('✅ Mint:', mint.publicKey.toString());
  
  // Step 2: Create authority ATA and mint tokens
  console.log('\n2️⃣ Minting 1B $Litter...');
  const authorityAta = await getOrCreateAssociatedTokenAccount(
    connection,
    authority,
    mint.publicKey,
    authority.publicKey
  );
  
  const mintAmount = 1_000_000_000_000_000_000; // 1B with 9 decimals
  const mintTx = new Transaction().add(
    createMintToInstruction(
      mint.publicKey,
      authorityAta.address,
      authority.publicKey,
      mintAmount
    )
  );
  const { blockhash: b2 } = await connection.getLatestBlockhash();
  mintTx.recentBlockhash = b2;
  await sendAndConfirmTransaction(connection, mintTx, [authority]);
  console.log('✅ Minted 1,000,000,000 $Litter');
  
  // Step 3: Create pool vault (98% of supply)
  console.log('\n3️⃣ Creating pool vault...');
  const poolVault = await getOrCreateAssociatedTokenAccount(
    connection,
    authority,
    mint.publicKey,
    authority.publicKey
  );
  
  // Transfer 98% to vault
  const vaultAmount = Math.floor(mintAmount * 0.98);
  const transferTx = new Transaction().add(
    createTransferInstruction(
      authorityAta.address,
      poolVault.address,
      authority.publicKey,
      vaultAmount
    )
  );
  const { blockhash: b3 } = await connection.getLatestBlockhash();
  transferTx.recentBlockhash = b3;
  await sendAndConfirmTransaction(connection, transferTx, [authority]);
  
  console.log('✅ Pool vault:', poolVault.address.toString());
  console.log('   Vault balance:', (vaultAmount / 1e9).toLocaleString(), '$Litter');
  console.log('   Authority balance:', ((mintAmount - vaultAmount) / 1e9).toLocaleString(), '$Litter');
  
  // Save to .env
  const envPath = path.join(__dirname, '../frontend/.env');
  const envContent = `VITE_PROGRAM_ID=GZMVhkNjd28Jsj8iUuMKfSg1mPdGuXCeUE3khgxxF7DM
VITE_CONFIG_PDA=61hXQB5wGsfwiMWezrHMe99iyiiiV2Qh5W9VRZnftq1W
VITE_POOL_PDA=HY1dgL4aD7pmvq5WhZUgF3zTLNemsR6FqzaLnA3TEb6g
VITE_LITTER_MINT=${mint.publicKey.toString()}
VITE_POOL_VAULT=${poolVault.address.toString()}
`;
  fs.writeFileSync(envPath, envContent);
  console.log('\n✅ Environment saved!');
  
  console.log('\n📋 Next: Run initialize-pool.js to create PDAs');
  console.log('   Then test deposits!');
}

main().catch(console.error);
