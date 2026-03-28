/**
 * Verify LitterBox v2 Deployment
 */

import { Connection, PublicKey } from '@solana/web3.js';

const PROGRAM_ID = new PublicKey('CyuzmNggCxLyupt8JBdMdisRn5yo1eUfBPne9BqTnt85');
const CONFIG_SEED = 'config';
const POOL_SEED = 'pool';
const RPC_URL = 'https://api.devnet.solana.com';

async function main() {
  console.log('🐱‍👤 LitterBox v2 - Verify Deployment\n');
  console.log('Program ID:', PROGRAM_ID.toString());

  const connection = new Connection(RPC_URL, 'confirmed');

  // Check program exists
  const programInfo = await connection.getAccountInfo(PROGRAM_ID);
  if (!programInfo) {
    console.error('❌ Program not deployed!');
    return;
  }
  console.log('✅ Program deployed');
  console.log('   Size:', programInfo.data.length, 'bytes');

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

  // Check Config
  const configInfo = await connection.getAccountInfo(configPda);
  if (configInfo) {
    console.log('\n✅ Config account exists');
    console.log('   Size:', configInfo.data.length, 'bytes');
    console.log('   Owner:', configInfo.owner.toString());
  } else {
    console.log('\n⏳ Config account not created yet (run init script)');
  }

  // Check Pool
  const poolInfo = await connection.getAccountInfo(poolPda);
  if (poolInfo) {
    console.log('\n✅ Pool account exists');
    console.log('   Size:', poolInfo.data.length, 'bytes');
    
    if (poolInfo.data.length === 40) {
      const virtualLitter = poolInfo.data.readBigUInt64LE(0);
      const virtualUsdc = poolInfo.data.readBigUInt64LE(8);
      const realLitter = poolInfo.data.readBigUInt64LE(16);
      const realUsdc = poolInfo.data.readBigUInt64LE(24);
      const isActive = poolInfo.data[32];
      
      console.log('\n📊 Pool State:');
      console.log(`   Virtual Litter: ${(Number(virtualLitter) / 1_000_000_000_000).toFixed(2)}`);
      console.log(`   Virtual USDC: ${(Number(virtualUsdc) / 1_000_000_000).toFixed(2)}`);
      console.log(`   Real Litter: ${(Number(realLitter) / 1_000_000_000_000).toFixed(2)}`);
      console.log(`   Real USDC: ${(Number(realUsdc) / 1_000_000_000).toFixed(2)}`);
      console.log(`   Active: ${isActive ? 'Yes ✅' : 'No ⏸️'}`);
    }
  } else {
    console.log('\n⏳ Pool account not created yet (run init script)');
  }

  console.log('\n✅ Deployment verified!');
  console.log('\nNext: Run deploy-and-init.ts to initialize');
}

main().catch(console.error);
