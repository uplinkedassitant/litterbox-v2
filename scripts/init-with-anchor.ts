#!/usr/bin/env ts-node
/**
 * Initialize LitterBox v2.0 using Anchor client (not raw transactions)
 * This ensures proper instruction encoding
 */
import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";

// Configuration
const PROGRAM_ID = new PublicKey("GqJ4yCJVavEMhYfwpb2M9ydrJXeFfi3Sw8zgHo3xK9hR");
const LITTER_MINT = new PublicKey("H5RwQLRyBAvVvXbYxzWRYFjXWPjfLtj2dtTPiChRTUK7");
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

async function main() {
  // Set up Anchor provider
  const provider = new anchor.AnchorProvider(
    new anchor.web3.Connection("http://127.0.0.1:8899", "confirmed"),
    {
      publicKey: PublicKey.default,
      signTransaction: async () => {},
      signAllTransactions: async () => {},
    } as any,
    { commitment: "confirmed" }
  );
  const connection = provider.connection;
  const wallet = provider.wallet as any;

  console.log(`Wallet: ${wallet.publicKey.toString()}`);
  console.log(`Program: ${PROGRAM_ID.toString()}\n`);

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
    ],
    accounts: [
      {
        name: "Config",
        type: {
          kind: "struct",
          fields: [
            { name: "authority", type: "publicKey" },
            { name: "litterMint", type: "publicKey" },
            { name: "usdcMint", type: "publicKey" },
            { name: "usdcVault", type: "publicKey" },
            { name: "litterVault", type: "publicKey" },
            { name: "graduationThreshold", type: "u64" },
            { name: "poolMode", type: "u8" },
            { name: "realPoolAddress", type: "publicKey" },
            { name: "bump", type: "u8" }
          ]
        }
      },
      {
        name: "VirtualPool",
        type: {
          kind: "struct",
          fields: [
            { name: "virtualUsdcReserve", type: "u64" },
            { name: "virtualLitterReserve", type: "u64" },
            { name: "accumulatedUsdc", type: "u64" },
            { name: "totalLitterDistributed", type: "u64" },
            { name: "bump", type: "u8" }
          ]
        }
      }
    ]
  };

  const program = new Program(idl as any, PROGRAM_ID.toString(), provider);
    // Create minimal IDL for initialize instruction
    idl = {
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
      ],
      accounts: [
        {
          name: "Config",
          type: {
            kind: "struct",
            fields: [
              { name: "authority", type: "publicKey" },
              { name: "litterMint", type: "publicKey" },
              { name: "usdcMint", type: "publicKey" },
              { name: "usdcVault", type: "publicKey" },
              { name: "litterVault", type: "publicKey" },
              { name: "graduationThreshold", type: "u64" },
              { name: "poolMode", type: "u8" },
              { name: "realPoolAddress", type: "publicKey" },
              { name: "bump", type: "u8" }
            ]
          }
        },
        {
          name: "VirtualPool",
          type: {
            kind: "struct",
            fields: [
              { name: "virtualUsdcReserve", type: "u64" },
              { name: "virtualLitterReserve", type: "u64" },
              { name: "accumulatedUsdc", type: "u64" },
              { name: "totalLitterDistributed", type: "u64" },
              { name: "bump", type: "u8" }
            ]
          }
        }
      ]
    };
  }

  const program = new Program(idl as any, PROGRAM_ID.toString(), provider);

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

  console.log("Initializing protocol with Anchor client...\n");

  try {
    // Use Anchor's method to initialize
    const tx = await program.methods
      .initialize(
        new BN("1000000000"), // graduationThreshold: 1 billion
        new BN("1000000000"), // virtualInitialUsdc: 1 billion
        new BN("1000000000000000000") // virtualInitialLitter: 1B with 9 decimals
      )
      .accounts({
        config: configPda,
        virtualPool: virtualPoolPda,
        usdcVault: usdcVaultPda,
        litterVault: litterVaultPda,
        litterMint: LITTER_MINT,
        usdcMint: USDC_MINT,
        authority: wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
      })
      .rpc();

    console.log("✅ Success! Protocol initialized!");
    console.log(`Transaction: ${tx}`);
  } catch (error: any) {
    console.log("❌ Error:", error.message);
    if (error.logs) {
      console.log("Logs:", error.logs);
    }
    throw error;
  }
}

main().catch(console.error);
