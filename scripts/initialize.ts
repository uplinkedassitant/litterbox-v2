#!/usr/bin/env ts-node
/**
 * Initialize LitterBox v2.0 Protocol
 * 
 * Usage:
 *   npx ts-node scripts/initialize.ts [options]
 * 
 * Options:
 *   --graduation-threshold: USDC threshold for graduation (default: 1000000000 = $1000)
 *   --virtual-initial-usdc: Initial virtual USDC (default: 1000000000 = 1000 USDC)
 *   --virtual-initial-litter: Initial virtual LITTER (default: 1000000000000000000 = 1B LITTER)
 */

import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { Program, AnchorProvider, BN, Wallet } from "@coral-xyz/anchor";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Import IDL
const IDL = require("../target/idl/litterbox_v2.json");
const PROGRAM_ID = process.env.LITTERBOX_PROGRAM_ID || "EqPiWgCG671GmkFMZTtn6GcUt2Xbc2p8rzj17dgFKX7m";

interface InitializeArgs {
  graduationThreshold: string;
  virtualInitialUsdc: string;
  virtualInitialLitter: string;
}

async function main() {
  // Parse command line arguments
  const args: InitializeArgs = {
    graduationThreshold: process.argv.find(a => a.startsWith("--graduation-threshold="))?.split("=")[1] || "1000000000",
    virtualInitialUsdc: process.argv.find(a => a.startsWith("--virtual-initial-usdc="))?.split("=")[1] || "1000000000",
    virtualInitialLitter: process.argv.find(a => a.startsWith("--virtual-initial-litter="))?.split("=")[1] || "1000000000000000000",
  };

  console.log("🚀 Initializing LitterBox v2.0 Protocol...\n");
  console.log("Configuration:");
  console.log(`  Graduation Threshold: ${Number(args.graduationThreshold) / 1e6} USDC`);
  console.log(`  Virtual Initial USDC: ${Number(args.virtualInitialUsdc) / 1e6} USDC`);
  console.log(`  Virtual Initial LITTER: ${Number(args.virtualInitialLitter) / 1e9} LITTER\n`);

  // Setup connection
  const connection = new Connection(
    process.env.ANCHOR_PROVIDER_URL || "http://127.0.0.1:8899",
    "confirmed"
  );

  // Load wallet
  const walletPath = process.env.ANCHOR_WALLET || path.join(
    process.env.HOME || process.env.USERPROFILE || "",
    ".config", "solana", "id.json"
  );
  
  const walletKeypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
  );

  const wallet = new Wallet(walletKeypair);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });

  // Create program instance
  const program = new Program(IDL, new PublicKey(PROGRAM_ID), provider);

  // Derive PDAs
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program.programId
  );

  const [virtualPoolPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("virtual_pool")],
    program.programId
  );

  // Get token mints from environment or use defaults
  const litterMint = new PublicKey(process.env.LITTER_MINT!);
  const usdcMint = new PublicKey(process.env.USDC_MINT || "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

  console.log(`Using LITTER Mint: ${litterMint.toString()}`);
  console.log(`Using USDC Mint: ${usdcMint.toString()}\n`);

  // Derive vault addresses
  const [usdcVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("usdc_vault"), configPda.toBuffer()],
    program.programId
  );

  const [litterVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("litter_vault"), configPda.toBuffer()],
    program.programId
  );

  console.log("Creating Protocol Accounts...");
  
  try {
    // Initialize the protocol
    const tx = await program.methods
      .initialize({
        graduationThreshold: new BN(args.graduationThreshold),
        virtualInitialUsdc: new BN(args.virtualInitialUsdc),
        virtualInitialLitter: new BN(args.virtualInitialLitter),
      })
      .accounts({
        config: configPda,
        virtualPool: virtualPoolPda,
        usdcVault: usdcVaultPda,
        litterVault: litterVaultPda,
        litterMint,
        usdcMint,
        authority: wallet.publicKey,
      })
      .rpc();

    console.log("✅ Protocol initialized successfully!");
    console.log(`Transaction: https://explorer.solana.com/tx/${tx}?cluster=devnet`);
    console.log("\nProtocol State:");
    console.log(`  Config PDA: ${configPda.toString()}`);
    console.log(`  Virtual Pool PDA: ${virtualPoolPda.toString()}`);
    console.log(`  USDC Vault: ${usdcVaultPda.toString()}`);
    console.log(`  LITTER Vault: ${litterVaultPda.toString()}`);
    console.log(`  Program ID: ${PROGRAM_ID}`);

  } catch (error: any) {
    console.error("❌ Initialization failed:", error.message);
    if (error.message.includes("already initialized")) {
      console.log("\n💡 Protocol appears to be already initialized.");
      console.log("To reinitialize, you may need to close the existing accounts first.");
    }
    process.exit(1);
  }
}

// Run initialization
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
