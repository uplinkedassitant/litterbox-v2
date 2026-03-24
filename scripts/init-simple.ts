#!/usr/bin/env ts-node
/**
 * Simple Initialize Script for LitterBox v2.0
 */
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { Program, AnchorProvider, Wallet, BN } from "@coral-xyz/anchor";
import * as fs from "fs";
import * as path from "path";

// Configuration
const PROGRAM_ID = new PublicKey("2RxULUUkU3PwMZVahAjfRgRovVadRRfn7XEqBozGo1d8");
const LITTER_MINT = new PublicKey("H5RwQLRyBAvVvXbYxzWRYFjXWPjfLtj2dtTPiChRTUK7");
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

async function main() {
  console.log("🚀 Initializing LitterBox v2.0 Protocol...\n");
  
  // Setup connection
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  
  // Load wallet
  const walletPath = path.join(process.env.HOME || "", ".config", "solana", "id.json");
  const walletKeypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
  );
  const wallet = new Wallet(walletKeypair);
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  
  // Load IDL
  const idlPath = path.join(__dirname, "../target/idl/litterbox_v2.json");
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  
  // Create program instance
  const program = new Program(idl, PROGRAM_ID, provider);
  
  console.log(`Program ID: ${PROGRAM_ID.toString()}`);
  console.log(`LITTER Mint: ${LITTER_MINT.toString()}`);
  console.log(`USDC Mint: ${USDC_MINT.toString()}\n`);
  
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
  
  console.log("Derived PDAs:");
  console.log(` Config: ${configPda.toString()}`);
  console.log(` Virtual Pool: ${virtualPoolPda.toString()}`);
  console.log(` USDC Vault: ${usdcVaultPda.toString()}`);
  console.log(` Litter Vault: ${litterVaultPda.toString()}\n`);
  
  // Check if already initialized
  try {
    const config = await program.account.config.fetch(configPda);
    console.log("✅ Protocol already initialized!");
    console.log(` Graduation Threshold: ${config.graduationThreshold.toString()}`);
    console.log(` Pool Mode: ${config.poolMode}`);
    return;
  } catch (e) {
    // Not initialized yet, proceed
    console.log("Protocol not initialized. Initializing now...\n");
  }
  
  // Initialize
  const tx = await program.methods
    .initialize({
      graduationThreshold: new BN(1_000_000_000), // $1000 USDC
      virtualInitialUsdc: new BN(1_000_000_000), // 1000 USDC
      virtualInitialLitter: new BN(1_000_000_000_000_000_000), // 1B LITTER
    })
    .accounts({
      config: configPda,
      virtualPool: virtualPoolPda,
      usdcVault: usdcVaultPda,
      litterVault: litterVaultPda,
      litterMint: LITTER_MINT,
      usdcMint: USDC_MINT,
      authority: wallet.publicKey,
    })
    .rpc();
  
  console.log("✅ Initialization successful!");
  console.log(` Transaction: https://solscan.io/tx/${tx}?cluster=devnet`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
