/**
 * LitterBox v2 Client
 * High-quality Solana Kit + Pinocchio integration
 */

import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
} from '@solana/web3.js';
import { Buffer } from 'buffer';

// Program configuration
export const PROGRAM_ID = new PublicKey(
  import.meta.env.VITE_PROGRAM_ID || 'AX6vgdmqDXRVd3kNwT8Xt7B49GcDTDFR4LwV7caxmZCG'
);
export const CONFIG_PDA = new PublicKey(
  import.meta.env.VITE_CONFIG_PDA || 'GSyYSVVz9yrk6XSeF9zMi9GzvtUk47mKVhjKJVW4HTGZ'
);
export const POOL_PDA = new PublicKey(
  import.meta.env.VITE_POOL_PDA || 'H3LwN5cS6zyX3iU8PwnDMXh4RbFAmwBKGkg81UzGuwFt'
);

// Token configuration (USDC on Devnet)
export const USDC_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
export const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

/**
 * Create swap instruction (USDC → LITTER)
 * 
 * Following Pinocchio pattern with all required accounts:
 * 0. [signer, writable] user
 * 1. [writable] config_pda
 * 2. [writable] pool_pda
 * 3. [writable] user_usdc_ata
 * 4. [writable] pool_usdc_ata
 * 5. [writable] user_litter_ata
 * 6. [] litter_mint
 * 7. [] token_program
 */
export function createSwapInstruction(
  user: PublicKey,
  userUsdcAta: PublicKey,
  poolUsdcAta: PublicKey,
  userLitterAta: PublicKey,
  litterMint: PublicKey,
  amount: number // in USDC units (6 decimals)
): TransactionInstruction {
  // Convert amount to u64 little-endian (6 decimals for USDC)
  const data = Buffer.alloc(9);
  data[0] = 1; // discriminator for swap
  data.writeBigUInt64LE(BigInt(Math.floor(amount * 1_000_000)), 1);

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: user, isSigner: true, isWritable: true },
      { pubkey: CONFIG_PDA, isSigner: false, isWritable: true },
      { pubkey: POOL_PDA, isSigner: false, isWritable: true },
      { pubkey: userUsdcAta, isSigner: false, isWritable: true },
      { pubkey: poolUsdcAta, isSigner: false, isWritable: true },
      { pubkey: userLitterAta, isSigner: false, isWritable: true },
      { pubkey: litterMint, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: data,
  });
}

/**
 * Create withdraw instruction (LITTER → USDC)
 * 
 * Account order matches the program's expectations:
 * 0. [signer, writable] user
 * 1. [writable] config_pda
 * 2. [writable] pool_pda
 * 3. [writable] user_usdc_ata
 * 4. [writable] pool_usdc_ata
 * 5. [writable] user_litter_ata
 * 6. [] litter_mint
 * 7. [] token_program
 */
export function createWithdrawInstruction(
  user: PublicKey,
  userUsdcAta: PublicKey,
  poolUsdcAta: PublicKey,
  userLitterAta: PublicKey,
  litterMint: PublicKey,
  amount: number // in LITTER units (6 decimals)
): TransactionInstruction {
  // Convert amount to u64 little-endian
  const data = Buffer.alloc(9);
  data[0] = 2; // discriminator for withdraw
  data.writeBigUInt64LE(BigInt(Math.floor(amount * 1_000_000)), 1);

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: user, isSigner: true, isWritable: true },
      { pubkey: CONFIG_PDA, isSigner: false, isWritable: true },
      { pubkey: POOL_PDA, isSigner: false, isWritable: true },
      { pubkey: userUsdcAta, isSigner: false, isWritable: true },
      { pubkey: poolUsdcAta, isSigner: false, isWritable: true },
      { pubkey: userLitterAta, isSigner: false, isWritable: true },
      { pubkey: litterMint, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: data,
  });
}

/**
 * Get or create associated token account
 * This is a helper for finding/creating ATAs
 */
export async function findAssociatedTokenAddress(
  walletAddress: PublicKey,
  tokenMint: PublicKey
): Promise<PublicKey> {
  const [associatedTokenAddress] = await PublicKey.findProgramAddressSync(
    [
      walletAddress.toBuffer(),
      TOKEN_PROGRAM_ID.toBuffer(),
      tokenMint.toBuffer(),
    ],
    new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL') // SPL Associated Token program
  );
  return associatedTokenAddress;
}
