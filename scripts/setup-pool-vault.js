#!/usr/bin/env node
/**
 * Create the pool's $LITTER token account (owned by authority, not PDA)
 */
const { Connection, Keypair, PublicKey } = require('@solana/web3.js');
const { getOrCreateAssociatedTokenAccount } = require('@solana/spl-token');
const fs = require('fs');
const path = require('path');
const os = require('os');

const LITTER_MINT = new PublicKey('DidDtGhw2vvHaR3KViTjjRypFnuUydCovB8Q2WSz4KC');
const RPC_URL = 'https://api.devnet.solana.com';

async function main() {
  const keypairPath = path.join(os.homedir(), '.config/solana/id_litterbox_v2.json');
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
  const authority = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  
  const connection = new Connection(RPC_URL, 'confirmed');
  
  console.log('Creating pool vault token account...');
  const poolVault = await getOrCreateAssociatedTokenAccount(
    connection,
    authority,
    LITTER_MINT,
    authority.publicKey // Owned by authority wallet, NOT PDA
  );
  
  console.log('Pool vault ATA:', poolVault.address.toString());
  console.log('Balance:', poolVault.amount.toString());
  
  // Save to .env
  const envPath = path.join(__dirname, 'frontend/.env');
  const env = fs.readFileSync(envPath, 'utf-8');
  fs.writeFileSync(envPath, env + `\nVITE_POOL_VAULT=${poolVault.address.toString()}`);
  
  console.log('\n✅ Pool vault created! Transfer 98% of $Litter supply here.');
}

main().catch(console.error);
