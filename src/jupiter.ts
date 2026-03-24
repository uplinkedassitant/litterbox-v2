/**
 * jupiter.ts — Phase 2 Jupiter Ultra integration
 * Handles token validation, swap orders, and instruction extraction
 */

export interface JupiterOrder {
  inAmount: string;
  outAmount: string;
  transaction: string;
  requestId: string;
}

export interface TokenValidation {
  isValid: boolean;
  reason?: string;
  isSus?: boolean;
  organicScore?: number;
}

export const JUPITER_BASE = "https://api.jup.ag";
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const MIN_ORGANIC_SCORE = 20;

async function jupiterFetch<T>(
  path: string,
  apiKey: string,
  init?: RequestInit,
  maxRetries = 3
): Promise<T> {
  let lastError: Error = new Error("Unknown error");
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(`${JUPITER_BASE}${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          ...init?.headers,
        },
      });

      if (res.status === 429) {
        const delay = Math.min(1000 * 2 ** attempt + Math.random() * 500, 10_000);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      if (!res.ok) {
        const body = await res.text().catch(() => `HTTP_${res.status}`);
        throw new Error(`Jupiter ${res.status}: ${body}`);
      }

      return res.json() as Promise<T>;
    } catch (err) {
      if (attempt === maxRetries) throw err;
      lastError = err as Error;
      const delay = Math.min(1000 * 2 ** attempt + Math.random() * 500, 10_000);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  
  throw lastError;
}

export async function validateToken(
  mintAddress: string,
  amountIn: bigint,
  apiKey: string
): Promise<TokenValidation> {
  // Shield check
  try {
    const shieldResult = await jupiterFetch<any>(
      `/ultra/v1/shield?mints=${mintAddress}`,
      apiKey
    );
    const tokenShield = shieldResult?.warnings?.[mintAddress];
    if (tokenShield?.isSus) {
      return {
        isValid: false,
        reason: `Token flagged by Jupiter Shield: ${tokenShield.label ?? "suspicious"}`,
        isSus: true,
      };
    }
  } catch (err) {
    console.warn("Shield check failed (non-fatal):", err);
  }

  // Route existence check
  try {
    const params = new URLSearchParams({
      inputMint: mintAddress,
      outputMint: USDC_MINT,
      amount: Math.min(Number(amountIn), 1_000_000).toString(),
      slippageBps: "100",
    });
    await jupiterFetch<any>(`/ultra/v1/order?${params}`, apiKey);
    return { isValid: true };
  } catch (err: any) {
    if (err?.message?.includes("400") || err?.message?.includes("No route")) {
      return {
        isValid: false,
        reason: "No Jupiter route exists for this token → USDC.",
      };
    }
    return {
      isValid: false,
      reason: `Route validation failed: ${err?.message ?? "unknown"}`,
    };
  }
}

export async function getSwapOrder(
  inputMint: string,
  amountIn: bigint,
  outputAccount: string,
  apiKey: string,
  slippageBps = 50
): Promise<JupiterOrder> {
  const params = new URLSearchParams({
    inputMint,
    outputMint: USDC_MINT,
    amount: amountIn.toString(),
    taker: outputAccount,
    slippageBps: slippageBps.toString(),
  });
  return jupiterFetch<JupiterOrder>(`/ultra/v1/order?${params}`, apiKey);
}

export async function extractJupiterInstructions(
  jupiterTxBase64: string,
  connection: any
): Promise<any> {
  const { VersionedTransaction, TransactionInstruction, PublicKey } =
    await import("@solana/web3.js");

  const bytes = Buffer.from(jupiterTxBase64, "base64");
  const jupiterTx = VersionedTransaction.deserialize(bytes);
  const { message } = jupiterTx;

  const addressLookupTables = await Promise.all(
    message.addressTableLookups.map(async (lookup: any) => {
      const res = await connection.getAddressLookupTable(lookup.accountKey);
      if (!res.value) {
        throw new Error(`ALT not found: ${lookup.accountKey.toBase58()}`);
      }
      return res.value;
    })
  );

  const accountKeys = message.getAccountKeys({
    addressLookupTableAccounts: addressLookupTables,
  });

  const jupiterInstructions = message.compiledInstructions.map((ix: any) => {
    const keys = ix.accountKeyIndexes.map((i: number) => ({
      pubkey: accountKeys.get(i)!,
      isSigner: message.isAccountSigner(i),
      isWritable: message.isAccountWritable(i),
    }));

    return new TransactionInstruction({
      programId: accountKeys.get(ix.programIdIndex)!,
      keys,
      data: Buffer.from(ix.data),
    });
  });

  return { jupiterInstructions, addressLookupTables };
}
