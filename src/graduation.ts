/**
 * graduation.ts — Phase 3 graduation flow client
 *
 * Handles the Virtual → Real transition by:
 * 1. Fetching Raydium CPMM fee configs from their API
 * 2. Building the Raydium CPMM initialize instruction via the SDK
 * 3. Bundling it with our graduate_to_real instruction in one V0 tx
 * 4. After confirmation, exposing helpers for flush_to_lp
 *
 * The bundle structure:
 * ix[0..n]: Raydium CPMM initialize + associated setup instructions
 * ix[n+1]: litterbox.graduateToReal (verifies pool, transfers seed liquidity)
 */

import {
  Connection,
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { Program, BN } from "@coral-xyz/anchor";
import { Raydium } from "@raydium-io/raydium-sdk-v2";
import {
  deriveConfigPda,
  deriveVirtualPoolPda,
  deriveVaultAuthorityPda,
} from "./deposit";
import { getGraduationStatus } from "./sweep";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
export const RAYDIUM_CPMM_MAINNET = new PublicKey(
  "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C"
);
export const RAYDIUM_CPMM_DEVNET = new PublicKey(
  "CPMDWBwJDtYax9qW7AyRuVC19Cc4L4Vcy4n2BHAbHkCW"
);

// ─────────────────────────────────────────────────────────────────────────────
// Raydium SDK setup
// ─────────────────────────────────────────────────────────────────────────────
export async function initRaydium(
  connection: Connection,
  owner: Keypair,
  cluster: "mainnet" | "devnet" = "devnet"
): Promise<Raydium> {
  return Raydium.load({
    connection,
    owner,
    cluster,
    disableLoadToken: true,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Derive the Raydium CPMM pool PDA
// ─────────────────────────────────────────────────────────────────────────────
export function deriveRaydiumCpmmPool(
  mintA: PublicKey,
  mintB: PublicKey,
  configId: PublicKey,
  cpmmProgramId: PublicKey = RAYDIUM_CPMM_MAINNET
): PublicKey {
  const [sortedMintA, sortedMintB] =
    mintA.toBuffer().compare(mintB.toBuffer()) < 0
      ? [mintA, mintB]
      : [mintB, mintA];

  const [poolAddress] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("pool"),
      configId.toBuffer(),
      sortedMintA.toBuffer(),
      sortedMintB.toBuffer(),
    ],
    cpmmProgramId
  );

  return poolAddress;
}

export function deriveRaydiumPoolVaults(
  poolId: PublicKey,
  mintA: PublicKey,
  mintB: PublicKey,
  cpmmProgramId: PublicKey = RAYDIUM_CPMM_MAINNET
): { vaultA: PublicKey; vaultB: PublicKey; authority: PublicKey } {
  const { getAssociatedTokenAddressSync } = require("@solana/spl-token");

  const [authority] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_and_lp_mint_auth_seed")],
    cpmmProgramId
  );

  const vaultA = getAssociatedTokenAddressSync(mintA, authority, true);
  const vaultB = getAssociatedTokenAddressSync(mintB, authority, true);

  return { vaultA, vaultB, authority };
}

// ─────────────────────────────────────────────────────────────────────────────
// Graduation flow
// ─────────────────────────────────────────────────────────────────────────────
export interface GraduationParams {
  connection: Connection;
  program: Program;
  caller: Keypair;
  cluster?: "mainnet" | "devnet";
  usdcFraction?: number;
  litterPerUsdc?: number;
}

export interface GraduationResult {
  signature: string;
  poolAddress: PublicKey;
  usdcSeeded: bigint;
  litterSeeded: bigint;
}

export async function graduateToReal(
  params: GraduationParams
): Promise<GraduationResult> {
  const {
    connection,
    program,
    caller,
    cluster = "devnet",
    usdcFraction = 1.0,
    litterPerUsdc,
  } = params;

  const programId = program.programId;

  // Check graduation readiness
  const status = await getGraduationStatus(program);
  if (!status.isReady) {
    throw new Error(
      `Not ready to graduate. Progress: ${status.progressPct.toFixed(
        1
      )}% ($${Number(status.accumulated) / 1e6} / $${Number(status.threshold) / 1e6})`
    );
  }

  // Fetch on-chain state
  const configPda = deriveConfigPda(programId);
  const virtualPoolPda = deriveVirtualPoolPda(programId);
  const vaultAuthority = deriveVaultAuthorityPda(programId);

  const [config, virtualPool] = await Promise.all([
    program.account.config.fetch(configPda) as Promise<any>,
    program.account.virtualPool.fetch(virtualPoolPda) as Promise<any>,
  ]);

  const litterMint = new PublicKey(config.litterMint);
  const usdcMint = new PublicKey(config.usdcMint);
  const cpmmProgramId =
    cluster === "mainnet" ? RAYDIUM_CPMM_MAINNET : RAYDIUM_CPMM_DEVNET;

  // Calculate seed amounts
  const totalUsdc = BigInt(virtualPool.accumulatedUsdc.toString());
  const usdcToSeed =
    (totalUsdc * BigInt(Math.floor(usdcFraction * 10_000))) / 10_000n;

  let litterToSeed: bigint;
  if (litterPerUsdc !== undefined) {
    litterToSeed = usdcToSeed * BigInt(Math.floor(litterPerUsdc));
  } else {
    const vUsdc = BigInt(virtualPool.virtualUsdcReserve.toString());
    const vLitter = BigInt(virtualPool.virtualLitterReserve.toString());
    litterToSeed = (usdcToSeed * vLitter) / vUsdc;
  }

  console.log(
    `Seeding pool with $${Number(usdcToSeed) / 1e6} USDC + ${Number(litterToSeed) / 1e9} LITTER`
  );

  // Initialize Raydium SDK
  const raydium = await initRaydium(connection, caller, cluster);

  // Fetch fee configs
  const feeConfigs = await raydium.api.fetchCpmmConfigs();
  const feeConfig = feeConfigs[0];

  console.log(
    `Using Raydium fee config: ${feeConfig.id} (${feeConfig.tradeFeeRate / 10000}% fee)`
  );

  // Derive pool addresses
  const poolId = deriveRaydiumCpmmPool(
    litterMint,
    usdcMint,
    new PublicKey(feeConfig.id),
    cpmmProgramId
  );

  const { vaultA, vaultB } = deriveRaydiumPoolVaults(
    poolId,
    litterMint,
    usdcMint,
    cpmmProgramId
  );

  console.log(`Raydium pool PDA: ${poolId.toBase58()}`);

  // Build Raydium initialize instruction
  const { transaction: raydiumTx } = await raydium.cpmm.createPool({
    mintA: {
      address: litterMint.toBase58(),
      decimals: 9,
      programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    },
    mintB: {
      address: usdcMint.toBase58(),
      decimals: 6,
      programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    },
    mintAAmount: new BN(litterToSeed.toString()),
    mintBAmount: new BN(usdcToSeed.toString()),
    startTime: new BN(0),
    feeConfig,
    txVersion: "V0",
    computeBudgetConfig: {
      units: 600_000,
      microLamports: 100_000,
    },
  });

  // Extract Raydium instructions
  const raydiumMessage = (raydiumTx as VersionedTransaction).message;
  const raydiumAlts = await Promise.all(
    raydiumMessage.addressTableLookups.map(async (lookup: any) => {
      const res = await connection.getAddressLookupTable(lookup.accountKey);
      if (!res.value)
        throw new Error(
          `Raydium ALT not found: ${lookup.accountKey.toBase58()}`
        );
      return res.value;
    })
  );

  const raydiumAccountKeys = raydiumMessage.getAccountKeys({
    addressLookupTableAccounts: raydiumAlts,
  });

  const raydiumInstructions: TransactionInstruction[] =
    raydiumMessage.compiledInstructions.map((ix: any) => {
      const keys = ix.accountKeyIndexes.map((i: number) => ({
        pubkey: raydiumAccountKeys.get(i)!,
        isSigner: raydiumMessage.isAccountSigner(i),
        isWritable: raydiumMessage.isAccountWritable(i),
      }));

      return new TransactionInstruction({
        programId: raydiumAccountKeys.get(ix.programIdIndex)!,
        keys,
        data: Buffer.from(ix.data),
      });
    });

  // Build graduate_to_real instruction
  const graduateIx = await program.methods
    .graduateToReal(
      new BN(usdcToSeed.toString()),
      new BN(litterToSeed.toString())
    )
    .accounts({
      caller: caller.publicKey,
      config: configPda,
      virtualPool: virtualPoolPda,
      usdcVault: new PublicKey(config.usdcVault),
      litterVault: new PublicKey(config.litterVault),
      vaultAuthority,
      raydiumUsdcVault: vaultB,
      raydiumLitterVault: vaultA,
      raydiumPool: poolId,
      raydiumCpmmProgram: cpmmProgramId,
    })
    .instruction();

  // Bundle instructions
  const { blockhash } = await connection.getLatestBlockhash();
  const message = new TransactionMessage({
    payerKey: caller.publicKey,
    recentBlockhash: blockhash,
    instructions: [...raydiumInstructions, graduateIx],
  }).compileToV0Message(raydiumAlts);

  const tx = new VersionedTransaction(message);

  // Simulate
  console.log("Simulating graduation transaction...");
  const sim = await connection.simulateTransaction(tx, { sigVerify: false });
  if (sim.value.err) {
    throw new Error(
      `Graduation simulation failed: ${JSON.stringify(
        sim.value.err
      )}\n${sim.value.logs?.join("\n")}`
    );
  }
  console.log(`Simulation OK. CUs: ${sim.value.unitsConsumed}`);

  // Sign and send
  tx.sign([caller]);
  const signature = await connection.sendRawTransaction(tx.serialize(), {
    maxRetries: 0,
    skipPreflight: true,
  });

  const latestBlockhash = await connection.getLatestBlockhash();
  const confirmation = await connection.confirmTransaction(
    {
      signature,
      ...latestBlockhash,
    },
    "confirmed"
  );

  if (confirmation.value.err) {
    throw new Error(
      `Graduation on-chain failure: ${JSON.stringify(confirmation.value.err)}`
    );
  }

  console.log(`Graduation confirmed: https://solscan.io/tx/${signature}`);
  console.log(
    `Raydium pool live: https://raydium.io/liquidity/?pool=${poolId.toBase58()}`
  );

  return {
    signature,
    poolAddress: poolId,
    usdcSeeded: usdcToSeed,
    litterSeeded: litterToSeed,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// flush_to_lp client
// ─────────────────────────────────────────────────────────────────────────────
export interface FlushParams {
  connection: Connection;
  program: Program;
  caller: Keypair;
  cluster?: "mainnet" | "devnet";
  flushAll?: boolean;
  usdcAmount?: bigint;
  litterAmount?: bigint;
}

export interface FlushResult {
  signature: string;
  usdcFlushed: bigint;
  litterFlushed: bigint;
}

export async function flushToLp(params: FlushParams): Promise<FlushResult> {
  const {
    connection,
    program,
    caller,
    cluster = "mainnet",
    flushAll = true,
    usdcAmount,
    litterAmount,
  } = params;

  const programId = program.programId;
  const configPda = deriveConfigPda(programId);
  const virtualPoolPda = deriveVirtualPoolPda(programId);
  const vaultAuthority = deriveVaultAuthorityPda(programId);

  // Fetch state
  const config = (await program.account.config.fetch(configPda)) as any;

  if (config.poolMode !== 1) {
    throw new Error(
      "Cannot flush to LP before graduation. Pool is still in Virtual mode."
    );
  }

  const usdcVault = new PublicKey(config.usdcVault);
  const litterVault = new PublicKey(config.litterVault);
  const litterMint = new PublicKey(config.litterMint);
  const usdcMint = new PublicKey(config.usdcMint);
  const cpmmProgramId =
    cluster === "mainnet" ? RAYDIUM_CPMM_MAINNET : RAYDIUM_CPMM_DEVNET;

  // Fetch vault balances
  const [usdcVaultInfo, litterVaultInfo] = await Promise.all([
    connection.getTokenAccountBalance(usdcVault),
    connection.getTokenAccountBalance(litterVault),
  ]);

  const availableUsdc = BigInt(usdcVaultInfo.value.amount);
  const availableLitter = BigInt(litterVaultInfo.value.amount);

  const flushUsdc = flushAll ? availableUsdc : (usdcAmount ?? 0n);
  const flushLitter = flushAll ? availableLitter : (litterAmount ?? 0n);

  if (flushUsdc === 0n && flushLitter === 0n) {
    throw new Error("Nothing to flush — both vault balances are zero.");
  }

  console.log(
    `Flushing $${Number(flushUsdc) / 1e6} USDC + ${Number(flushLitter) / 1e9} LITTER to pool`
  );

  // Derive Raydium vault addresses
  const poolId = new PublicKey(config.realPoolAddress);
  const { vaultA, vaultB } = deriveRaydiumPoolVaults(
    poolId,
    litterMint,
    usdcMint,
    cpmmProgramId
  );

  // Build flush_to_lp instruction
  const flushIx = await program.methods
    .flushToLp(new BN(flushUsdc.toString()), new BN(flushLitter.toString()))
    .accounts({
      caller: caller.publicKey,
      config: configPda,
      usdcVault,
      litterVault,
      vaultAuthority,
      raydiumUsdcVault: vaultB,
      raydiumLitterVault: vaultA,
    })
    .instruction();

  // Send transaction
  const { blockhash } = await connection.getLatestBlockhash();
  const message = new TransactionMessage({
    payerKey: caller.publicKey,
    recentBlockhash: blockhash,
    instructions: [flushIx],
  }).compileToV0Message();

  const tx = new VersionedTransaction(message);

  const sim = await connection.simulateTransaction(tx, { sigVerify: false });
  if (sim.value.err) {
    throw new Error(
      `Flush simulation failed: ${JSON.stringify(sim.value.err)}`
    );
  }

  tx.sign([caller]);
  const signature = await connection.sendRawTransaction(tx.serialize(), {
    maxRetries: 0,
    skipPreflight: true,
  });

  const latestBlockhash = await connection.getLatestBlockhash();
  const confirmation = await connection.confirmTransaction(
    {
      signature,
      ...latestBlockhash,
    },
    "confirmed"
  );

  if (confirmation.value.err) {
    throw new Error(
      `Flush on-chain failure: ${JSON.stringify(confirmation.value.err)}`
    );
  }

  console.log(`Flush confirmed: https://solscan.io/tx/${signature}`);
  console.log(
    `Pool liquidity increased: $${Number(flushUsdc) / 1e6} USDC + ${Number(flushLitter) / 1e9} LITTER`
  );

  return {
    signature,
    usdcFlushed: flushUsdc,
    litterFlushed: flushLitter,
  };
}
