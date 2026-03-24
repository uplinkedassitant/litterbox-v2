#!/usr/bin/env node
const anchor = require("@coral-xyz/anchor");
const { PublicKey, Transaction, SystemProgram } = require("@solana/web3.js");
const fs = require('fs');
const path = require('path');

const PROGRAM_ID = new PublicKey("GqJ4yCJVavEMhYfwpb2M9ydrJXeFfi3Sw8zgHo3xK9hR");
const LITTER_MINT = new PublicKey("H5RwQLRyBAvVvXbYxzWRYFjXWPjfLtj2dtTPiChRTUK7");
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

async function main() {
  const provider = anchor.AnchorProvider.local("http://127.0.0.1:8899");
  anchor.setProvider(provider);
  const connection = provider.connection;
  const wallet = provider.wallet;

  console.log(`Wallet: ${wallet.publicKey.toString()}`);
  console.log(`Program: ${PROGRAM_ID.toString()}\n`);

  // Load IDL
  const idlPath = path.join(__dirname, 'target/idl/litterbox_v2.json');
  const idl = JSON.parse(fs.readFileSync(idlPath, 'utf-8'));

  const program = new anchor.Program(idl, PROGRAM_ID, provider);

  // Derive PDAs using correct seeds (lowercase with underscores)
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

  console.log("Initializing protocol...\n");

  try {
    const tx = await program.methods
      .initialize(
        new anchor.BN(1_000_000_000),
        new anchor.BN(1_000_000_000),
        new anchor.BN(1_000_000_000_000_000_000)
      )
      .accounts({
        config: configPda,
        virtualPool: virtualPoolPda,
        usdcVault: usdcVaultPda,
        litterVault: litterVaultPda,
        litterMint: LITTER_MINT,
        usdcMint: USDC_MINT,
        authority: wallet.publicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
      })
      .rpc();

    console.log("✅ Success! Protocol initialized!");
    console.log(`Transaction: ${tx}`);
  } catch (error) {
    console.log("❌ Error:", error.message);
    if (error.logs) {
      console.log("Logs:", error.logs);
    }
    throw error;
  }
}

main().catch(console.error);
