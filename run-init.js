#!/usr/bin/env node
const anchor = require("@coral-xyz/anchor");
const { PublicKey } = require("@solana/web3.js");

async function main() {
  const provider = anchor.AnchorProvider.local("http://127.0.0.1:8899");
  anchor.setProvider(provider);
  
  const program = anchor.workspace.LitterboxV2;
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program.programId
  );
  const [virtualPoolPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("virtual_pool")],
    program.programId
  );
  const [usdcVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("usdc_vault"), configPda.toBuffer()],
    program.programId
  );
  const [litterVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("litter_vault"), configPda.toBuffer()],
    program.programId
  );

  const litterMint = new PublicKey("H5RwQLRyBAvVvXbYxzWRYFjXWPjfLtj2dtTPiChRTUK7");
  const usdcMint = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

  console.log("Initializing protocol...");
  console.log("Program ID:", program.programId.toString());
  console.log("Config PDA:", configPda.toString());

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
        litterMint,
        usdcMint,
      })
      .rpc();

    console.log("✅ Success! Protocol initialized!");
    console.log("Transaction:", tx);
  } catch (error) {
    console.log("❌ Error:", error.message);
    if (error.logs) {
      console.log("Logs:", error.logs);
    }
    throw error;
  }
}

main().catch(console.error);
