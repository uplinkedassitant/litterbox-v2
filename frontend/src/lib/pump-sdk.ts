/**
 * LitterBox v2 - Powered by Pump.fun SDK
 * 
 * Uses the official pump.fun TypeScript SDK for:
 * - Token creation
 * - Bonding curve trading (buy/sell)
 * - Graduation tracking
 * - Fee sharing
 */

import { Connection, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { OnlinePumpSdk, PUMP_SDK, getBuyTokenAmountFromSolAmount, getSellSolAmountFromTokenAmount } from "@nirholas/pump-sdk";
import BN from "bn.js";

// Pump.fun program IDs
export const PUMP_PROGRAM_ID = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
export const PUMP_AMM_PROGRAM_ID = "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA";

// $LITTER token config (will be created on launch)
export interface LitterTokenConfig {
  name: string;
  symbol: string;
  description: string;
  imageUrl: string;
}

export class LitterBoxSDK {
  private pumpSdk: OnlinePumpSdk;
  private connection: Connection;
  
  // $Litter token state
  private tokenMint: PublicKey | null = null;
  private isGraduated: boolean = false;

  constructor(connection: Connection) {
    this.connection = connection;
    this.pumpSdk = new OnlinePumpSdk(connection);
  }

  /**
   * Create the $Litter token on pump.fun
   */
  async createToken(
    creator: PublicKey,
    config: LitterTokenConfig
  ): Promise<{ mint: PublicKey; instructions: TransactionInstruction[] }> {
    const mintKeypair = Keypair.generate();
    
    const createIx = await PUMP_SDK.createV2Instruction({
      mint: mintKeypair.publicKey,
      name: config.name,
      symbol: config.symbol,
      uri: config.imageUrl, // Metadata URI
      creator,
      user: creator,
      mayhemMode: false,
    });

    this.tokenMint = mintKeypair.publicKey;
    
    return {
      mint: mintKeypair.publicKey,
      instructions: [createIx],
    };
  }

  /**
   * Buy $Litter tokens (deposit SOL)
   */
  async buy(
    user: PublicKey,
    solAmount: number // in SOL
  ): Promise<{ instructions: TransactionInstruction[] }> {
    if (!this.tokenMint) {
      throw new Error("Token not initialized. Call createToken() first.");
    }

    const solAmountBN = new BN(solAmount * 1_000_000_000); // Convert to lamports
    
    // Fetch required state
    const [buyState, global, feeConfig] = await Promise.all([
      this.pumpSdk.fetchBuyState(this.tokenMint, user),
      this.pumpSdk.fetchGlobal(),
      this.pumpSdk.fetchFeeConfig(),
    ]);

    if (buyState.bondingCurve.complete) {
      throw new Error("Token has graduated to AMM. Use Raydium swap instead.");
    }

    // Calculate expected tokens
    const expectedTokens = getBuyTokenAmountFromSolAmount({
      global,
      feeConfig,
      mintSupply: buyState.bondingCurve.tokenTotalSupply,
      bondingCurve: buyState.bondingCurve,
      amount: solAmountBN,
    });

    // Build buy instructions
    const buyIxs = await this.pumpSdk.buyInstructions({
      ...buyState,
      mint: this.tokenMint,
      user,
      amount: expectedTokens,
      solAmount: solAmountBN,
      slippage: 0.05, // 5% slippage
    });

    return { instructions: buyIxs };
  }

  /**
   * Sell $Litter tokens (withdraw SOL)
   */
  async sell(
    user: PublicKey,
    tokenAmount: number // in tokens
  ): Promise<{ instructions: TransactionInstruction[] }> {
    if (!this.tokenMint) {
      throw new Error("Token not initialized");
    }

    const tokenAmountBN = new BN(tokenAmount * 1_000_000); // Assuming 6 decimals
    
    // Fetch required state
    const [sellState, global, feeConfig] = await Promise.all([
      this.pumpSdk.fetchSellState(this.tokenMint, user),
      this.pumpSdk.fetchGlobal(),
      this.pumpSdk.fetchFeeConfig(),
    ]);

    if (sellState.bondingCurve.complete) {
      throw new Error("Token has graduated. Use Raydium swap instead.");
    }

    // Calculate expected SOL
    const expectedSol = getSellSolAmountFromTokenAmount({
      global,
      feeConfig,
      mintSupply: sellState.bondingCurve.tokenTotalSupply,
      bondingCurve: sellState.bondingCurve,
      amount: tokenAmountBN,
    });

    // Build sell instructions
    const sellIxs = await this.pumpSdk.sellInstructions({
      ...sellState,
      mint: this.tokenMint,
      user,
      amount: tokenAmountBN,
      solAmount: expectedSol,
      slippage: 0.05,
    });

    return { instructions: sellIxs };
  }

  /**
   * Check graduation progress
   */
  async getGraduationProgress(): Promise<{
    progressBps: number;
    isGraduated: boolean;
    tokensRemaining: string;
    solAccumulated: string;
  }> {
    if (!this.tokenMint) {
      throw new Error("Token not initialized");
    }

    const progress = await this.pumpSdk.fetchGraduationProgress(this.tokenMint);
    this.isGraduated = progress.isGraduated;
    
    return {
      progressBps: progress.progressBps / 100, // Convert to percentage
      isGraduated: progress.isGraduated,
      tokensRemaining: progress.tokensRemaining.toString(),
      solAccumulated: progress.solAccumulated.toString(),
    };
  }

  /**
   * Set token mint (for existing tokens)
   */
  setTokenMint(mint: string) {
    this.tokenMint = new PublicKey(mint);
  }

  /**
   * Get current token mint
   */
  getTokenMint(): PublicKey | null {
    return this.tokenMint;
  }

  /**
   * Check if token has graduated to AMM
   */
  getIsGraduated(): boolean {
    return this.isGraduated;
  }
}

// Export singleton instance
let sdkInstance: LitterBoxSDK | null = null;

export function getLitterBoxSdk(connection: Connection): LitterBoxSDK {
  if (!sdkInstance) {
    sdkInstance = new LitterBoxSDK(connection);
  }
  return sdkInstance;
}
