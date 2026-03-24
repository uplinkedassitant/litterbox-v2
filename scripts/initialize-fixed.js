#!/usr/bin/env node
/**
 * LitterBox v2.0 — Fixed Initialization Script (JavaScript version)
 *
 * Key fixes vs. original:
 * 1. config and virtualPool are generated as fresh Keypairs (no seeds on Initialize context)
 * 2. usdc_vault / litter_vault derived as ATAs of config, NOT as program PDAs
 * 3. Both config and virtualPool keypairs must sign the transaction
 */
const anchor = require("@coral-xyz/anchor");
const { Connection, Keypair, PublicKey, SystemProgram } = require("@solana/web3.js");
const { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } = require("@solana/spl-token");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

// ─── Configuration ────────────────────────────────────────────────────────────
// Program ID must match declare_id! in lib.rs AND what's deployed on-chain
const PROGRAM_ID = process.env.LITTERBOX_PROGRAM_ID || "8LhTE9owPwbdJMHbE7Nwi9i2H66JsPHzjwWbKPgLUa7t";

// Devnet USDC mint (Circle's official devnet USDC)
const DEVNET_USDC_MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

// Graduation = $1000 USDC (6 decimals)
const GRADUATION_THRESHOLD = "1000000000"; // 1,000 USDC
const VIRTUAL_INITIAL_USDC = "1000000000"; // 1,000 USDC
const VIRTUAL_INITIAL_LITTER = "1000000000000000000"; // 1B LITTER (9 decimals)

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  // --- Setup provider ---
  const connection = new Connection(
    process.env.ANCHOR_PROVIDER_URL || "https://api.devnet.solana.com",
    "confirmed"
  );
  const walletPath = process.env.ANCHOR_WALLET || path.join(process.env.HOME || "", ".config", "solana", "id.json");
  const walletKeypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
  );
  const wallet = { publicKey: walletKeypair.publicKey, signTransaction: async (tx) => tx, signAllTransactions: async (txs) => txs };
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });

  // --- Load IDL ---
  const IDL = JSON.parse(fs.readFileSync(path.join(__dirname, "../target/idl/litterbox_v2.json"), "utf-8"));
  const program = new anchor.Program(IDL, PROGRAM_ID, provider);

  // --- Resolve mints ---
  if (!process.env.LITTER_MINT) {
    throw new Error("LITTER_MINT env var is required");
  }
  const litterMint = new PublicKey(process.env.LITTER_MINT);
  const usdcMint = new PublicKey(process.env.USDC_MINT || DEVNET_USDC_MINT);

  console.log("🚀 LitterBox v2.0 Initialization");
  console.log("──────────────────────────────────");
  console.log(`Program ID : ${PROGRAM_ID}`);
  console.log(`Authority  : ${walletKeypair.publicKey.toString()}`);
  console.log(`LITTER mint: ${litterMint.toString()}`);
  console.log(`USDC mint  : ${usdcMint.toString()}`);

  // ─── FIX #1: config and virtualPool are plain `init` accounts (no seeds) ───
  const configKeypair = Keypair.generate();
  const virtualPoolKeypair = Keypair.generate();
  console.log(`\nGenerated accounts (save these!):`);
  console.log(`  config       : ${configKeypair.publicKey.toString()}`);
  console.log(`  virtualPool  : ${virtualPoolKeypair.publicKey.toString()}`);

  // ─── FIX #2: Vaults are ATAs owned by config, NOT program PDAs ───────────
  const usdcVault = getAssociatedTokenAddressSync(usdcMint, configKeypair.publicKey, true);
  const litterVault = getAssociatedTokenAddressSync(litterMint, configKeypair.publicKey, true);
  console.log(`\nDerived vault ATAs:`);
  console.log(`  usdcVault  : ${usdcVault.toString()}`);
  console.log(`  litterVault: ${litterVault.toString()}`);

  // ─── Check balance ────────────────────────────────────────────────────────
  const balance = await connection.getBalance(walletKeypair.publicKey);
  console.log(`\nWallet SOL balance: ${balance / 1e9} SOL`);
  if (balance < 0.1 * 1e9) {
    throw new Error("Insufficient SOL. Run: solana airdrop 2 --url devnet");
  }

  // ─── Send initialize transaction ─────────────────────────────────────────
  console.log("\nSending initialize transaction...");
  try {
    const tx = await program.methods
      .initialize({
        graduationThreshold: new anchor.BN(GRADUATION_THRESHOLD),
        virtualInitialUsdc: new anchor.BN(VIRTUAL_INITIAL_USDC),
        virtualInitialLitter: new anchor.BN(VIRTUAL_INITIAL_LITTER),
      })
      .accounts({
        config: configKeypair.publicKey,
        virtualPool: virtualPoolKeypair.publicKey,
        usdcVault,
        litterVault,
        litterMint,
        usdcMint,
        authority: walletKeypair.publicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .signers([configKeypair, virtualPoolKeypair])
      .rpc();

    console.log("\n✅ Protocol initialized successfully!");
    console.log(`TX: http://explorer.solana.com/tx/${tx}?cluster=custom`);

    // Save addresses for future use
    const state = {
      programId: PROGRAM_ID,
      config: configKeypair.publicKey.toString(),
      virtualPool: virtualPoolKeypair.publicKey.toString(),
      usdcVault: usdcVault.toString(),
      litterVault: litterVault.toString(),
      litterMint: litterMint.toString(),
      usdcMint: usdcMint.toString(),
      authority: walletKeypair.publicKey.toString(),
      configSecretKey: Array.from(configKeypair.secretKey),
      virtualPoolSecretKey: Array.from(virtualPoolKeypair.secretKey),
    };
    const outPath = path.join(__dirname, "../protocol-state.json");
    fs.writeFileSync(outPath, JSON.stringify(state, null, 2));
    console.log(`\nProtocol state saved to: ${outPath}`);
    console.log("Keep protocol-state.json — you need these addresses for all future calls.");
  } catch (err) {
    console.error("\n❌ Initialization failed:", err.message || err);
    if (err.logs) {
      console.error("\nProgram logs:");
      err.logs.forEach((log) => console.error(" ", log));
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
