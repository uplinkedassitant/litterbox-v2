/**
 * graduate.ts — Phase 3 graduation client
 * Bundles Raydium CPMM pool creation + litterbox.graduateToReal
 */

import {
  Connection,
  Keypair,
  PublicKey,
  TransactionInstruction,
  VersionedTransaction,
  TransactionMessage,
} from "@solana/web3.js";
import { Program, BN } from "@coral-xyz/anchor";
import {
  deriveConfigPda,
  deriveVirtualPoolPda,
  deriveVaultAuthorityPda,
} from "./deposit";
import { getGraduationStatus } from "./sweep";

export const RAYDIUM_CPMM_MAINNET = new PublicKey(
  "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C"
);
export const RAYDIUM_CPMM_DEVNET = new PublicKey(
  "CPMDWBwJDtYax9qW7AyRuVC19Cc4L4Vcy4n2BHAbHkCW"
);

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

  // Initialize Raydium SDK and fetch fee config
  const raydium = await initRaydium(connection, caller, cluster);
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

  // Build Raydium initialize instructions
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
        throw new Error(`Raydium ALT not found: ${lookup.accountKey.toBase58()}`);
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

// Helper functions (placeholders - would need Raydium SDK imports)
async function initRaydium(
  connection: Connection,
  caller: Keypair,
  cluster: string
) {
  // This would use @raydium-io/raydium-sdk
  throw new Error("Raydium SDK integration required");
}

function deriveRaydiumCpmmPool(
  mintA: PublicKey,
  mintB: PublicKey,
  feeConfig: PublicKey,
  cpmmProgram: PublicKey
): PublicKey {
  const [pool] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("cpmm_pool"),
      mintA.toBuffer(),
      mintB.toBuffer(),
      feeConfig.toBuffer(),
    ],
    cpmmProgram
  );
  return pool;
}

function deriveRaydiumPoolVaults(
  poolId: PublicKey,
  mintA: PublicKey,
  mintB: PublicKey,
  cpmmProgram: PublicKey
) {
  const [vaultA] = PublicKey.findProgramAddressSync(
    [poolId.toBuffer(), mintA.toBuffer()],
    cpmmProgram
  );
  const [vaultB] = PublicKey.findProgramAddressSync(
    [poolId.toBuffer(), mintB.toBuffer()],
    cpmmProgram
  );
  return { vaultA, vaultB };
}
