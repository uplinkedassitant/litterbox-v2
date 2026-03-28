/**
 * LitterBox v2.0 — Fixed Initialization with proper Borsh serialization
 */
const { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, SystemProgram, sendAndConfirmTransaction } = require("@solana/web3.js");
const { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } = require("@solana/spl-token");
const { BN } = require("bn.js");
const fs = require("fs");
const path = require("path");

const PROGRAM_ID = new PublicKey(process.env.LITTERBOX_PROGRAM_ID || "GqJ4yCJVavEMhYfwpb2M9ydrJXeFfi3Sw8zgHo3xK9hR");

if (!process.env.LITTER_MINT) {
  console.error("❌ Error: LITTER_MINT env var is required.");
  console.error("   Usage: LITTER_MINT=<address> node init-fixed.js");
  process.exit(1);
}

const LITTER_MINT = new PublicKey(process.env.LITTER_MINT);
const USDC_MINT = new PublicKey(process.env.USDC_MINT || "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

// Discriminator for "global:initialize"
const INITIALIZE_DISCRIMINATOR = Buffer.from([175, 175, 109, 31, 13, 152, 155, 237]);

// Protocol parameters
const GRADUATION_THRESHOLD = new BN("1000000000"); // 1,000 USDC
const VIRTUAL_INITIAL_USDC = new BN("1000000000"); // 1,000 USDC
const VIRTUAL_INITIAL_LITTER = new BN("1000000000000000000"); // 1B LITTER

async function main() {
  console.log("🚀 LitterBox v2.0 — Devnet Initialization (Fixed)");
  console.log("──────────────────────────────────────────────────");
  console.log(`Program ID : ${PROGRAM_ID.toString()}`);
  console.log(`LITTER Mint : ${LITTER_MINT.toString()}`);
  console.log(`USDC Mint   : ${USDC_MINT.toString()}`);
  console.log();

  const rpcUrl = process.env.ANCHOR_PROVIDER_URL || "https://api.devnet.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");
  console.log(`RPC : ${rpcUrl}`);

  const walletPath = process.env.ANCHOR_WALLET || path.join(process.env.HOME || "", ".config", "solana", "id.json");
  const walletKeypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
  );
  console.log(`Authority : ${walletKeypair.publicKey.toString()}`);

  const balance = await connection.getBalance(walletKeypair.publicKey);
  console.log(`Balance : ${(balance / 1e9).toFixed(4)} SOL`);

  if (balance < 0.05 * 1e9) {
    console.error("\n❌ Balance too low. Run: solana airdrop 2 --url devnet");
    process.exit(1);
  }

  const configKeypair = Keypair.generate();
  const virtualPoolKeypair = Keypair.generate();
  console.log("\n📝 Generated accounts:");
  console.log(`  config      : ${configKeypair.publicKey.toString()}`);
  console.log(`  virtualPool : ${virtualPoolKeypair.publicKey.toString()}`);

  const usdcVault = getAssociatedTokenAddressSync(USDC_MINT, configKeypair.publicKey, true);
  const litterVault = getAssociatedTokenAddressSync(LITTER_MINT, configKeypair.publicKey, true);
  console.log("\n🏦 Vault addresses:");
  console.log(`  usdcVault   : ${usdcVault.toString()}`);
  console.log(`  litterVault : ${litterVault.toString()}`);

  // Serialize InitializeParams using borsh
  // Borsh expects: u64 values as BN, serialized in order
  const encodeInitializeParams = (params) => {
    const graduationThreshold = params.graduation_threshold.toBuffer('le', 8);
    const virtualInitialUsdc = params.virtual_initial_usdc.toBuffer('le', 8);
    const virtualInitialLitter = params.virtual_initial_litter.toBuffer('le', 8);
    return Buffer.concat([graduationThreshold, virtualInitialUsdc, virtualInitialLitter]);
  };

  const initializeParams = {
    graduation_threshold: GRADUATION_THRESHOLD,
    virtual_initial_usdc: VIRTUAL_INITIAL_USDC,
    virtual_initial_litter: VIRTUAL_INITIAL_LITTER,
  };

  const encodedParams = encodeInitializeParams(initializeParams);

  const instructionData = Buffer.concat([INITIALIZE_DISCRIMINATOR, encodedParams]);

  const keys = [
    { pubkey: configKeypair.publicKey, isWritable: true, isSigner: true },
    { pubkey: virtualPoolKeypair.publicKey, isWritable: true, isSigner: true },
    { pubkey: usdcVault, isWritable: true, isSigner: false },
    { pubkey: litterVault, isWritable: true, isSigner: false },
    { pubkey: LITTER_MINT, isWritable: false, isSigner: false },
    { pubkey: USDC_MINT, isWritable: false, isSigner: false },
    { pubkey: walletKeypair.publicKey, isWritable: false, isSigner: true },
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
      [walletKeypair, configKeypair, virtualPoolKeypair],
      { commitment: "confirmed" }
    );

    console.log("\n✅ Protocol initialized successfully!");
    console.log(`TX : https://explorer.solana.com/tx/${sig}?cluster=devnet`);
    console.log(`Scan: https://solscan.io/tx/${sig}?cluster=devnet`);

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
      _configSecretKey: Array.from(configKeypair.secretKey),
      _virtualPoolSecretKey: Array.from(virtualPoolKeypair.secretKey),
    };

    const outPath = path.join(__dirname, "protocol-state.json");
    fs.writeFileSync(outPath, JSON.stringify(state, null, 2));
    console.log(`\n💾 State saved to: protocol-state.json`);
  } catch (err) {
    console.error("\n❌ Transaction failed:", err.message || err);
    if (err.logs && err.logs.length) {
      console.error("\nProgram logs:");
      err.logs.forEach((l) => console.error(" ", l));
    }
    process.exit(1);
  }
}

main();
