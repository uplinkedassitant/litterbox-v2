const { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, SystemProgram } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');
const { BN } = require('bn.js');
const { getAssociatedTokenAddressSync } = require('@solana/spl-token');

const PROGRAM_ID = new PublicKey("2RxULUUkU3PwMZVahAjfRgRovVadRRfn7XEqBozGo1d8");
const LITTER_MINT = new PublicKey("H5RwQLRyBAvVvXbYxzWRYFjXWPjfLtj2dtTPiChRTUK7");
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const CLUSTER_URL = "https://api.devnet.solana.com";

// Seeds
const CONFIG_SEED = "config";
const VIRTUAL_POOL_SEED = "virtual_pool";
const USDC_VAULT_SEED = "usdc_vault";
const LITTER_VAULT_SEED = "litter_vault";

async function main() {
  console.log("🚀 Initializing LitterBox v2.0 Protocol...\n");
  
  const connection = new Connection(CLUSTER_URL, "confirmed");
  
  // Load wallet
  const walletPath = path.join(process.env.HOME || "", ".config", "solana", "id.json");
  const walletKeypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
  );
  
  console.log(`Wallet: ${walletKeypair.publicKey.toString()}`);
  console.log(`Program: ${PROGRAM_ID.toString()}\n`);
  
  // Derive PDAs
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from(CONFIG_SEED)],
    PROGRAM_ID
  );
  
  const [virtualPoolPda] = PublicKey.findProgramAddressSync(
    [Buffer.from(VIRTUAL_POOL_SEED)],
    PROGRAM_ID
  );
  
  const [usdcVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from(USDC_VAULT_SEED), configPda.toBuffer()],
    PROGRAM_ID
  );
  
  const [litterVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from(LITTER_VAULT_SEED), configPda.toBuffer()],
    PROGRAM_ID
  );
  
  console.log("Derived PDAs:");
  console.log(`  Config: ${configPda.toString()}`);
  console.log(`  Virtual Pool: ${virtualPoolPda.toString()}`);
  console.log(`  USDC Vault: ${usdcVaultPda.toString()}`);
  console.log(`  Litter Vault: ${litterVaultPda.toString()}\n`);
  
  // Check if already initialized
  try {
    const configData = await connection.getAccountInfo(configPda);
    if (configData && configData.data.length > 0) {
      console.log("✅ Protocol already initialized!");
      return;
    }
  } catch (e) {
    // Account doesn't exist yet
  }
  
  console.log("Protocol not initialized. Building initialization transaction...\n");
  
  // Create initialize instruction data (discriminator + args)
  const discriminator = [175, 175, 109, 31, 131, 149, 117, 81];
  const graduationThreshold = new BN("1000000000", 10).toArrayLike(Buffer, "le", 8);
  const virtualInitialUsdc = new BN("1000000000", 10).toArrayLike(Buffer, "le", 8);
  const virtualInitialLitter = new BN("1000000000000000000", 10).toArrayLike(Buffer, "le", 8);
  
  const initializeData = Buffer.concat([
    Buffer.from(discriminator),
    graduationThreshold,
    virtualInitialUsdc,
    virtualInitialLitter,
  ]);
  
  // Build accounts for initialize instruction
  const keys = [
    { pubkey: configPda, isWritable: true, isSigner: false },
    { pubkey: virtualPoolPda, isWritable: true, isSigner: false },
    { pubkey: usdcVaultPda, isWritable: true, isSigner: false },
    { pubkey: litterVaultPda, isWritable: true, isSigner: false },
    { pubkey: LITTER_MINT, isWritable: false, isSigner: false },
    { pubkey: USDC_MINT, isWritable: false, isSigner: false },
    { pubkey: walletKeypair.publicKey, isWritable: true, isSigner: true },
    { pubkey: SystemProgram.programId, isWritable: false, isSigner: false },
    { pubkey: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"), isWritable: false, isSigner: false },
    { pubkey: new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"), isWritable: false, isSigner: false },
  ];
  
  const initializeIx = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: keys,
    data: initializeData,
  });
  
  // Create and send transaction
  const transaction = new Transaction().add(initializeIx);
  transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  transaction.feePayer = walletKeypair.publicKey;
  
  console.log("Sending initialization transaction...");
  const signature = await connection.sendTransaction(transaction, [walletKeypair]);
  
  console.log("\n✅ Initialization transaction sent!");
  console.log(`Signature: ${signature}`);
  console.log(`View on Solscan: https://solscan.io/tx/${signature}?cluster=devnet`);
  
  // Wait for confirmation
  console.log("\nWaiting for confirmation...");
  const confirmation = await connection.confirmTransaction(signature, "confirmed");
  
  if (confirmation.value.err) {
    console.error("❌ Transaction failed:", confirmation.value.err);
    process.exit(1);
  }
  
  console.log("✅ Transaction confirmed!");
  console.log("\n🎉 LitterBox v2.0 Protocol initialized successfully!");
  console.log(`Config PDA: ${configPda.toString()}`);
  console.log(`Virtual Pool PDA: ${virtualPoolPda.toString()}`);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
