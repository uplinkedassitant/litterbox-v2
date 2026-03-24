import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { LitterboxV2 } from "../target/types/litterbox_v2";
import { assert } from "chai";

describe("litterbox_v2", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider();
  const connection = provider.connection;
  const wallet = (provider as anchor.AnchorProvider).wallet;

  it("Initialize protocol", async () => {
    const program = anchor.workspace.LitterboxV2 as Program<LitterboxV2>;
    
    const [configPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      program.programId
    );
    
    const [virtualPoolPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("virtual_pool")],
      program.programId
    );
    
    const [usdcVaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("usdc_vault"), configPda.toBuffer()],
      program.programId
    );
    
    const [litterVaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("litter_vault"), configPda.toBuffer()],
      program.programId
    );
    
    const litterMint = new anchor.web3.PublicKey("H5RwQLRyBAvVvXbYxzWRYFjXWPjfLtj2dtTPiChRTUK7");
    const usdcMint = new anchor.web3.PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
    
    console.log("Initializing protocol...");
    console.log("Config PDA:", configPda.toString());
    
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
        litterMint: litterMint,
        usdcMint: usdcMint,
        authority: wallet.publicKey,
      })
      .rpc();
    
    console.log("Initialized! Tx:", tx);
  });
});
