/**
 * LitterBox v2.0 — Definitive Devnet Initialization
 *
 * Bypasses Anchor's Program constructor entirely (avoids the Anchor 0.32
 * IDL-parsing bug that throws "_bn" TypeError) and builds the transaction
 * manually with every account and discriminator correct.
 *
 * Usage:
 *   LITTER_MINT=<address> node init-devnet.js
 *
 * Prerequisites:
 *   npm install @solana/web3.js @solana/spl-token bn.js
 *   solana config set --url devnet
 *   solana airdrop 2 (if balance is low)
 */
const {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  sendAndConfirmTransaction,
} = require("@solana/web3.js");
const {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} = require("@solana/spl-token");
const { BN } = require("bn.js");
const fs = require("fs");
const path = require("path");
const borsh = require("borsh");

// ─── Program & Mint Configuration ─────────────────────────────────────────────
// Must match declare_id! in lib.rs AND what is deployed on-chain
const PROGRAM_ID = new PublicKey(
  process.env.LITTERBOX_PROGRAM_ID || "GqJ4yCJVavEMhYfwpb2M9ydrJXeFfi3Sw8zgHo3xK9hR"
);

// Set LITTER_MINT env var to your deployed mint address
if (!process.env.LITTER_MINT) {
  console.error("❌ Error: LITTER_MINT env var is required.");
  console.error(" Usage: LITTER_MINT=<address> node init-devnet.js");
  process.exit(1);
}
const LITTER_MINT = new PublicKey(process.env.LITTER_MINT);

// Devnet USDC (Circle's official devnet mint)
const USDC_MINT = new PublicKey(
  process.env.USDC_MINT || "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
);

// ─── Anchor Instruction Discriminator ─────────────────────────────────────────
// Discriminator = SHA256("global:initialize")[0..8]
// Verified: [175, 175, 109, 31, 13, 152, 155, 237]
//
// NOTE: All previous scripts in this repo used [175,175,109,31, 131,149,117,81]
// which is WRONG — bytes 5-7 are different. This alone would cause every
// raw transaction to fail with a discriminator mismatch error.
const INITIALIZE_DISCRIMINATOR = Buffer.from([
  175, 175, 109, 31, 13, 152, 155, 237
]);

// ─── Protocol Parameters ──────────────────────────────────────────────────────
const GRADUATION_THRESHOLD = new BN("1000000000"); // 1,000 USDC (6 decimals)
const VIRTUAL_INITIAL_USDC = new BN("1000000000"); // 1,000 USDC
const VIRTUAL_INITIAL_LITTER = new BN("1000000000000000000"); // 1B LITTER (9 decimals)

// ─── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🚀 LitterBox v2.0 — Devnet Initialization");
  console.log("──────────────────────────────────────────");
  console.log(`Program ID : ${PROGRAM_ID.toString()}`);
  console.log(`LITTER Mint : ${LITTER_MINT.toString()}`);
  console.log(`USDC Mint : ${USDC_MINT.toString()}`);
  console.log();

  // --- Connection ---
  const rpcUrl = process.env.ANCHOR_PROVIDER_URL || "https://api.devnet.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");
  console.log(`RPC : ${rpcUrl}`);

  // --- Wallet ---
  const walletPath =
    process.env.ANCHOR_WALLET || path.join(process.env.HOME || "", ".config", "solana", "id.json");
  const walletKeypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
  );
  console.log(`Authority : ${walletKeypair.publicKey.toString()}`);

  // --- Balance check ---
  const balance = await connection.getBalance(walletKeypair.publicKey);
  console.log(`Balance : ${(balance / 1e9).toFixed(4)} SOL`);
  if (balance < 0.05 * 1e9) {
    console.error("\n❌ Balance too low. Run: solana airdrop 2 --url devnet");
    process.exit(1);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FIX #1: config and virtualPool must be FRESH KEYPAIRS, not PDAs.
  // The Initialize context in lib.rs is:
  // #[account(init, payer = authority, space = 8 + 177)]
  // pub config: Account<'info, state::Config>,
  // There are NO seeds on this account in the Initialize context.
  // Seeds (b"config", b"virtual_pool") only appear on SweepAndSwap,
  // GraduateToReal, and FlushToLp — NOT on Initialize.
  // Both keypairs must be signers in the transaction.
  // ─────────────────────────────────────────────────────────────────────────
  const configKeypair = Keypair.generate();
  const virtualPoolKeypair = Keypair.generate();
  console.log("\n📝 Generated accounts (SAVE THESE):");
  console.log(`  config      : ${configKeypair.publicKey.toString()}`);
  console.log(`  virtualPool : ${virtualPoolKeypair.publicKey.toString()}`);

  // ─────────────────────────────────────────────────────────────────────────
  // FIX #2: Vaults are ATAs owned by config, NOT program PDAs.
  // The Initialize context uses:
  // #[account(init, associated_token::mint = usdc_mint,
  //           associated_token::authority = config)]
  // pub usdc_vault: Account<'info, TokenAccount>,
  // This means the vault address = ATA(configKeypair.publicKey, usdcMint).
  // Previous scripts derived them as findProgramAddressSync(["usdc_vault", ...])
  // which produces a completely different address — the program would reject it.
  // ─────────────────────────────────────────────────────────────────────────
  const usdcVault = getAssociatedTokenAddressSync(
    USDC_MINT,
    configKeypair.publicKey,
    true // allowOwnerOffCurve=true since config is a program-owned account
  );
  const litterVault = getAssociatedTokenAddressSync(
    LITTER_MINT,
    configKeypair.publicKey,
    true
  );
  console.log("\n🏦 Vault addresses (ATAs of config):");
  console.log(`  usdcVault  : ${usdcVault.toString()}`);
  console.log(`  litterVault: ${litterVault.toString()}`);

  // ─────────────────────────────────────────────────────────────────────────
  // FIX #3: Correct discriminator.
  // All previous scripts used [175,175,109,31, 131,149,117,81].
  // The correct SHA256("global:initialize")[0..8] is:
  // [175, 175, 109, 31, 13, 152, 155, 237]
  // Bytes 5-7 are completely different. This caused every raw tx to fail.
  // ─────────────────────────────────────────────────────────────────────────
  const instructionData = Buffer.concat([
    INITIALIZE_DISCRIMINATOR,
    GRADUATION_THRESHOLD.toArrayLike(Buffer, "le", 8),
    VIRTUAL_INITIAL_USDC.toArrayLike(Buffer, "le", 8),
    VIRTUAL_INITIAL_LITTER.toArrayLike(Buffer, "le", 8),
  ]);

  // ─────────────────────────────────────────────────────────────────────────
  // Account list — must match the exact order in the Initialize<'info> struct:
  //  0. config writable, signer (init)
  //  1. virtual_pool writable, signer (init)
  //  2. usdc_vault writable, not signer (init ATA)
  //  3. litter_vault writable, not signer (init ATA)
  //  4. litter_mint not writable, not signer
  //  5. usdc_mint not writable, not signer
  //  6. authority writable, signer (payer)
  //  7. system_program not writable, not signer
  //  8. token_program not writable, not signer
  //  9. associated_token_program not writable, not signer
  // ─────────────────────────────────────────────────────────────────────────
  const keys = [
    { pubkey: configKeypair.publicKey, isWritable: true, isSigner: true },
    { pubkey: virtualPoolKeypair.publicKey, isWritable: true, isSigner: true },
    { pubkey: usdcVault, isWritable: true, isSigner: false },
    { pubkey: litterVault, isWritable: true, isSigner: false },
    { pubkey: LITTER_MINT, isWritable: false, isSigner: false },
    { pubkey: USDC_MINT, isWritable: false, isSigner: false },
    { pubkey: walletKeypair.publicKey, isWritable: true, isSigner: true },
    { pubkey: SystemProgram.programId, isWritable: false, isSigner: false },
    { pubkey: TOKEN_PROGRAM_ID, isWritable: false, isSigner: false },
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isWritable: false, isSigner: false },
  ];

  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys,
    data: instructionData,
  });

  const tx = new Transaction().add(ix);

  console.log("\n📡 Sending transaction...");
  try {
    const sig = await sendAndConfirmTransaction(
      connection,
      tx,
      // All three keypairs that have isSigner: true must sign
      [walletKeypair, configKeypair, virtualPoolKeypair],
      { commitment: "confirmed" }
    );

    console.log("\n✅ Protocol initialized successfully!");
    console.log(`TX  : https://explorer.solana.com/tx/${sig}?cluster=devnet`);
    console.log(`Scan: https://solscan.io/tx/${sig}?cluster=devnet`);

    // Save state to disk
    const state = {
      programId: PROGRAM_ID.toString(),
      config: configKeypair.publicKey.toString(),
      virtualPool: virtualPoolKeypair.publicKey.toString(),
      usdcVault: usdcVault.toString(),
      litterVault: litterVault.toString(),
      litterMint: LITTER_MINT.toString(),
      usdcMint: USDC_MINT.toString(),
      authority: walletKeypair.publicKey.toString(),
      txSignature: sig,
      // Store secret keys so future scripts can reconstruct these accounts if needed
      _configSecretKey: Array.from(configKeypair.secretKey),
      _virtualPoolSecretKey: Array.from(virtualPoolKeypair.secretKey),
    };
    const outPath = path.join(__dirname, "protocol-state.json");
    fs.writeFileSync(outPath, JSON.stringify(state, null, 2));
    console.log(`\n💾 State saved to: protocol-state.json`);
    console.log("  Keep this file — config and virtualPool addresses are");
    console.log("  NOT derivable from seeds. You must reference them directly.");
  } catch (err) {
    console.error("\n❌ Transaction failed:", err.message || err);
    // Anchor/Solana errors embed program logs — print them for debugging
    if (err.logs && err.logs.length) {
      console.error("\nProgram logs:");
      err.logs.forEach((l) => console.error(" ", l));
    }
    process.exit(1);
  }
}

main();
