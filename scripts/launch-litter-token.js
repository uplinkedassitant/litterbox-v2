#!/usr/bin/env node
/**
 * Launch the OFFICIAL $Litter token on pump.fun
 * 
 * This creates the token that LitterBox platform will trade.
 * ONE-TIME setup for the platform.
 */

const { Connection, Keypair, PublicKey, VersionedTransaction } = require('@solana/web3.js');
const { PUMP_SDK } = require('@nirholas/pump-sdk');
const fs = require('fs');
const path = require('path');
const os = require('os');

// $Litter token metadata
const LITTER_CONFIG = {
  name: 'LitterBox Token',
  symbol: '$LITTER',
  description: 'The official token of LitterBox - where ideas go to grow!',
  imageUrl: 'https://your-domain.com/litter-token-icon.png', // Upload your logo
  website: 'https://litterbox.uplinkedmd.com',
  twitter: '@litterbox',
};

async function main() {
  console.log('🐱 LitterBox - Launching $Litter Token\n');
  console.log('═══════════════════════════════════════════\n');

  // Load authority wallet
  const keypairPath = path.join(os.homedir(), '.config/solana/id_litterbox_v2.json');
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
  const authority = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  
  console.log('📦 Token Details:');
  console.log(`   Name: ${LITTER_CONFIG.name}`);
  console.log(`   Symbol: ${LITTER_CONFIG.symbol}`);
  console.log(`   Description: ${LITTER_CONFIG.description}`);
  console.log('');
  console.log(`Creator: ${authority.publicKey.toString()}\n`);

  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  // Check balance
  const balance = await connection.getBalance(authority.publicKey);
  const balanceSol = balance / 1_000_000_000;
  console.log(`SOL Balance: ${balanceSol.toFixed(4)} SOL`);
  
  if (balanceSol < 0.5) {
    console.error('❌ Need at least 0.5 SOL for token creation and initial liquidity');
    return;
  }

  // Generate mint keypair
  const mintKeypair = Keypair.generate();
  console.log('\n🪙 Creating token mint...');
  console.log(`   Mint: ${mintKeypair.publicKey.toString()}`);

  try {
    // Create token using pump.fun SDK
    const createIx = await PUMP_SDK.createV2Instruction({
      mint: mintKeypair.publicKey,
      name: LITTER_CONFIG.name,
      symbol: LITTER_CONFIG.symbol,
      uri: LITTER_CONFIG.imageUrl,
      creator: authority.publicKey,
      user: authority.publicKey,
      mayhemMode: false,
    });

    // Build transaction
    const { blockhash } = await connection.getLatestBlockhash();
    const transaction = new VersionedTransaction(
      new TransactionMessage({
        payerKey: authority.publicKey,
        recentBlockhash: blockhash,
        instructions: [createIx],
      }).compileToV0Message()
    );

    // Sign and send
    transaction.sign([authority, mintKeypair]);
    
    console.log('📡 Sending transaction...');
    const signature = await connection.sendTransaction(transaction);
    console.log('✅ Token created!');
    console.log(`   Signature: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    
    // Wait for confirmation
    await connection.confirmTransaction(signature);
    
    // Save to .env
    const envPath = path.join(__dirname, '../frontend/.env');
    const envContent = `VITE_PROGRAM_ID=GZMVhkNjd28Jsj8iUuMKfSg1mPdGuXCeUE3khgxxF7DM
VITE_CONFIG_PDA=61hXQB5wGsfwiMWezrHMe99iyiiiV2Qh5W9VRZnftq1W
VITE_POOL_PDA=HY1dgL4aD7pmvq5WhZUgF3zTLNemsR6FqzaLnA3TEb6g
VITE_LITTER_MINT=${mintKeypair.publicKey.toString()}
VITE_LITTER_NAME=${LITTER_CONFIG.name}
VITE_LITTER_SYMBOL=${LITTER_CONFIG.symbol}
`;
    fs.writeFileSync(envPath, envContent);
    console.log('\n✅ Environment saved!');
    
    console.log('\n🎉 $Litter token is LIVE!');
    console.log('\n📋 Next steps:');
    console.log('   1. Update Vercel environment variables');
    console.log('   2. Upload token logo/metadata');
    console.log('   3. Test buying/selling on the platform');
    console.log('   4. Share with users!');
    
    console.log('\n💡 Token Info:');
    console.log(`   Mint: ${mintKeypair.publicKey.toString()}`);
    console.log(`   Symbol: ${LITTER_CONFIG.symbol}`);
    console.log(`   Network: Solana Devnet`);
    
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    console.error('\nMake sure you have enough SOL and try again.');
  }
}

main().catch(console.error);
