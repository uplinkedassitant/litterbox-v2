#!/usr/bin/env ts-node
/**
 * Final initialization attempt - uses correct program ID
 */
import { 
  Connection, 
  Keypair, 
  PublicKey, 
  Transaction,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";
import { BN } from "bn.js";

// Configuration - Use the OLD deployed program
const PROGRAM_ID = new PublicKey("2RxULUUkU3PwMZVahAjfRgRovVadRRfn7XEqBozGo1d8");
const LITTER_MINT = new PublicKey("H5RwQLRyBAvVvXbYxzWRYFjXWPjfLtj2dtTPiChRTUK7");
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const CLUSTER_URL = "https://api.devnet.solana.com";

// Instruction discriminator for initialize
const INITIALIZE_DISCRIMINATOR = [175, 175, 109, 31, 131, 149, 117, 81];

async function main() {
  console.log("🚀 Initializing LitterBox v2.0...\n");
  console.log(`Program: ${PROGRAM_ID.toString()}`);
  console.log(`LITTER: ${LITTER_MINT.toString()}\n`);
  
  const connection = new Connection(CLUSTER_URL, "confirmed");
  
  // Load wallet
  const walletPath = path.join(process.env.HOME || "", ".config", "solana", "id.json");
  const walletKeypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
  );
  
  // Derive PDAs
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    PROGRAM_ID
  );
  
  const [virtualPoolPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("virtual_pool")],
    PROGRAM_ID
  );
  
  const [usdcVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("usdc_vault"), configPda.toBuffer()],
    PROGRAM_ID
  );
  
  const [litterVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("litter_vault"), configPda.toBuffer()],
    PROGRAM_ID
  );
  
  console.log("PDAs:");
  console.log(`  Config: ${configPda.toString()}`);
  console.log(`  Pool: ${virtualPoolPda.toString()}`);
  console.log(`  USDC Vault: ${usdcVaultPda.toString()}`);
  console.log(`  Litter Vault: ${litterVaultPda.toString()}\n`);
  
  // Check if already initialized
  try {
    const configInfo = await connection.getAccountInfo(configPda);
    if (configInfo && configInfo.data.length > 0) {
      console.log("✅ Already initialized!");
      return;
    }
  } catch (e) {}
  
  // Build instruction data
  const data = Buffer.concat([
    Buffer.from(INITIALIZE_DISCRIMINATOR),
    new BN("1000000000", 10).toArrayLike(Buffer, "le", 8),  // threshold
    new BN("1000000000", 10).toArrayLike(Buffer, "le", 8),  // initial USDC
    new BN("1000000000000000000", 10).toArrayLike(Buffer, "le", 8),  // initial LITTER
  ]);
  
  // Get token program IDs
  const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
  const ASSOC_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
  
  // Build instruction
  const keys = [
    { pubkey: configPda, isWritable: true, isSigner: false },
    { pubkey: virtualPoolPda, isWritable: true, isSigner: false },
    { pubkey: usdcVaultPda, isWritable: true, isSigner: false },
    { pubkey: litterVaultPda, isWritable: true, isSigner: false },
    { pubkey: LITTER_MINT, isWritable: false, isSigner: false },
    { pubkey: USDC_MINT, isWritable: false, isSigner: false },
    { pubkey: walletKeypair.publicKey, isWritable: true, isSigner: true },
    { pubkey: SystemProgram.programId, isWritable: false, isSigner: false },
    { pubkey: TOKEN_PROGRAM_ID, isWritable: false, isSigner: false },
    { pubkey: ASSOC_TOKEN_PROGRAM_ID, isWritable: false, isSigner: false },
  ];
  
  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: keys as any,
    data: data,
  });
  
  const tx = new Transaction().add(ix);
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.feePayer = walletKeypair.publicKey;
  
  console.log("Sending transaction...");
  const sig = await connection.sendTransaction(tx, [walletKeypair]);
  console.log(`Signature: ${sig}`);
  console.log(`https://solscan.io/tx/${sig}?cluster=devnet`);
  
  const conf = await connection.confirmTransaction(sig, "confirmed");
  if (conf.value.err) {
    console.error("Failed:", conf.value.err);
    process.exit(1);
  }
  
  console.log("\n✅ Success! Protocol initialized.");
}

main().catch(console.error);
