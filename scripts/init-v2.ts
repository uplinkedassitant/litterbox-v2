#!/usr/bin/env ts-node
/**
 * Initialize LitterBox v2.0 - Fixed for Anchor 0.30
 */
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { Program, AnchorProvider, Wallet, BN, Idl } from "@coral-xyz/anchor";
import * as fs from "fs";
import * as path from "path";

const PROGRAM_ID = "2RxULUUkU3PwMZVahAjfRgRovVadRRfn7XEqBozGo1d8";
const LITTER_MINT = "H5RwQLRyBAvVvXbYxzWRYFjXWPjfLtj2dtTPiChRTUK7";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

async function main() {
  console.log("🚀 Initializing LitterBox v2.0 Protocol...\n");
  
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  
  const walletPath = path.join(process.env.HOME || "", ".config", "solana", "id.json");
  const walletKeypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
  );
  const wallet = new Wallet(walletKeypair);
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  
  // Load IDL
  const idlPath = path.join(__dirname, "../target/idl/litterbox_v2.json");
  const idl: Idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  
  // For Anchor 0.30, Program constructor is (idl, provider)
  const program = new Program(idl, provider);
  
  console.log(`Program ID: ${PROGRAM_ID}`);
  console.log(`LITTER Mint: ${LITTER_MINT}`);
  console.log(`USDC Mint: ${USDC_MINT}\n`);
  
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    new PublicKey(PROGRAM_ID)
  );
  
  const [virtualPoolPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("virtual_pool")],
    new PublicKey(PROGRAM_ID)
  );
  
  const [usdcVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("usdc_vault"), configPda.toBuffer()],
    new PublicKey(PROGRAM_ID)
  );
  
  const [litterVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("litter_vault"), configPda.toBuffer()],
    new PublicKey(PROGRAM_ID)
  );
  
  console.log("Derived PDAs:");
  console.log(` Config: ${configPda.toString()}`);
  console.log(` Virtual Pool: ${virtualPoolPda.toString()}`);
  console.log(` USDC Vault: ${usdcVaultPda.toString()}`);
  console.log(` Litter Vault: ${litterVaultPda.toString()}\n`);
  
  try {
    const config = await (program.account as any).config.fetch(configPda);
    console.log("✅ Protocol already initialized!");
    return;
  } catch (e) {
    console.log("Protocol not initialized. Initializing now...\n");
  }
  
  const tx = await program.methods
    .initialize({
      graduationThreshold: new BN(1_000_000_000),
      virtualInitialUsdc: new BN(1_000_000_000),
      virtualInitialLitter: new BN(1_000_000_000_000_000_000),
    })
    .accounts({
      config: configPda,
      virtualPool: virtualPoolPda,
      usdcVault: usdcVaultPda,
      litterVault: litterVaultPda,
      litterMint: new PublicKey(LITTER_MINT),
      usdcMint: new PublicKey(USDC_MINT),
      authority: wallet.publicKey,
    })
    .rpc();
  
  console.log("✅ Initialization successful!");
  console.log(`Transaction: https://solscan.io/tx/${tx}?cluster=devnet`);
}

main().catch(console.error);
