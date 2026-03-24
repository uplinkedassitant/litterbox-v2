#!/usr/bin/env node
/**
 * Simple JS test to initialize LitterBox v2.0
 * Uses minimal dependencies to avoid TypeScript issues
 */
const anchor = require("@coral-xyz/anchor");
const { PublicKey, Transaction, SystemProgram } = require("@solana/web3.js");
const BN = anchor.BN;

const PROGRAM_ID = new PublicKey("GqJ4yCJVavEMhYfwpb2M9ydrJXeFfi3Sw8zgHo3xK9hR");
const LITTER_MINT = new PublicKey("H5RwQLRyBAvVvXbYxzWRYFjXWPjfLtj2dtTPiChRTUK7");
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

async function main() {
  const connection = new anchor.web3.Connection("http://127.0.0.1:8899", "confirmed");
  const wallet = anchor.AnchorProvider.local().wallet;
  
  console.log(`Wallet: ${wallet.publicKey.toString()}`);
  console.log(`Program: ${PROGRAM_ID.toString()}\n`);

  // Derive PDAs
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("CONFIG")],
    PROGRAM_ID
  );
  const [virtualPoolPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("VIRTUAL_POOL")],
    PROGRAM_ID
  );
  const [usdcVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("USDC_VAULT"), configPda.toBuffer()],
    PROGRAM_ID
  );
  const [litterVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("LITTER_VAULT"), configPda.toBuffer()],
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

  // Create minimal IDL
  const idl = {
    version: "0.2.0",
    name: "litterbox_v2",
    instructions: [
      {
        name: "initialize",
        accounts: [
          { name: "config", isMut: true, isSigner: false },
          { name: "virtualPool", isMut: true, isSigner: false },
          { name: "usdcVault", isMut: true, isSigner: false },
          { name: "litterVault", isMut: true, isSigner: false },
          { name: "litterMint", isMut: false, isSigner: false },
          { name: "usdcMint", isMut: false, isSigner: false },
          { name: "authority", isMut: true, isSigner: true },
          { name: "systemProgram", isMut: false, isSigner: false },
          { name: "tokenProgram", isMut: false, isSigner: false },
          { name: "associatedTokenProgram", isMut: false, isSigner: false },
        ],
        args: [
          { name: "graduationThreshold", type: "u64" },
          { name: "virtualInitialUsdc", type: "u64" },
          { name: "virtualInitialLitter", type: "u64" }
        ]
      }
    ]
  };

  const program = new anchor.Program(idl, PROGRAM_ID.toString(), anchor.AnchorProvider.local());

  try {
    const tx = await program.methods
      .initialize(
        new BN("1000000000"),
        new BN("1000000000"),
        new BN("1000000000000000000")
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
