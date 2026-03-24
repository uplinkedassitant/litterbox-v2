#!/usr/bin/env ts-node
/**
 * LitterBox v2.0 — Fixed Initialization Script
 *
 * Key fixes vs. original scripts/initialize.ts:
 * 1. config and virtualPool are generated as fresh Keypairs (no seeds on Initialize context)
 * 2. usdc_vault / litter_vault derived as ATAs of config, NOT as program PDAs
 * 3. Both config and virtualPool keypairs must sign the transaction
 */
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import {
  Program,
  AnchorProvider,
  BN,
  Wallet,
} from "@coral-xyz/anchor";
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

// ─── Configuration ────────────────────────────────────────────────────────────
// Program ID must match declare_id! in lib.rs AND what's deployed on-chain
const PROGRAM_ID =
  process.env.LITTERBOX_PROGRAM_ID || "8LhTE9owPwbdJMHbE7Nwi9i2H66JsPHzjwWbKPgLUa7t";

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
  const walletPath =
    process.env.ANCHOR_WALLET ||
    path.join(process.env.HOME || "", ".config", "solana", "id.json");
  const walletKeypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
  );
  const wallet = new Wallet(walletKeypair);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });

  // --- Load IDL ---
  const IDL = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../target/idl/litterbox_v2.json"),
      "utf-8"
    )
  );
  const program = new Program(IDL, new PublicKey(PROGRAM_ID), provider);

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
  // The Initialize context in lib.rs has:
  // #[account(init, payer = authority, space = 8 + 177)]
  // pub config: Account<'info, state::Config>,
  // There are NO seeds here — these are fresh keypair accounts.
  // (Seeds only appear on SweepAndSwap / GraduateToReal / FlushToLp contexts.)
  const configKeypair = Keypair.generate();
  const virtualPoolKeypair = Keypair.generate();
  console.log(`\nGenerated accounts (save these!):`);
  console.log(`  config       : ${configKeypair.publicKey.toString()}`);
  console.log(`  virtualPool  : ${virtualPoolKeypair.publicKey.toString()}`);

  // ─── FIX #2: Vaults are ATAs owned by config, NOT program PDAs ───────────
  // The Initialize context has:
  // #[account(init, associated_token::mint = usdc_mint, associated_token::authority = config)]
  // pub usdc_vault: Account<'info, TokenAccount>,
  // So the vault addresses are ATAs of the config account.
  const usdcVault = getAssociatedTokenAddressSync(
    usdcMint,
    configKeypair.publicKey,
    true // allowOwnerOffCurve = true since config may be off-curve
  );
  const litterVault = getAssociatedTokenAddressSync(
    litterMint,
    configKeypair.publicKey,
    true
  );
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
        graduationThreshold: new BN(GRADUATION_THRESHOLD),
        virtualInitialUsdc: new BN(VIRTUAL_INITIAL_USDC),
        virtualInitialLitter: new BN(VIRTUAL_INITIAL_LITTER),
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
      // FIX #3: config and virtualPool keypairs must be passed as signers
      .signers([configKeypair, virtualPoolKeypair])
      .rpc();

    console.log("\n✅ Protocol initialized successfully!");
    console.log(`TX: https://explorer.solana.com/tx/${tx}?cluster=devnet`);

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
      // Save secret keys so you can reference these accounts later if needed
      configSecretKey: Array.from(configKeypair.secretKey),
      virtualPoolSecretKey: Array.from(virtualPoolKeypair.secretKey),
    };
    const outPath = path.join(__dirname, "../protocol-state.json");
    fs.writeFileSync(outPath, JSON.stringify(state, null, 2));
    console.log(`\nProtocol state saved to: ${outPath}`);
    console.log(
      "Keep protocol-state.json — you need these addresses for all future calls."
    );
  } catch (err: any) {
    console.error("\n❌ Initialization failed:", err.message || err);
    if (err.logs) {
      console.error("\nProgram logs:");
      err.logs.forEach((log: string) => console.error(" ", log));
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
