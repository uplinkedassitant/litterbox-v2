#![no_std]

use pinocchio::{
    account_info::AccountInfo,
    entrypoint,
    instruction::{Seed, Signer},
    program_error::ProgramError,
    pubkey::{self, Pubkey},
    ProgramResult,
};
use pinocchio_pubkey::declare_id;
use pinocchio_system::instructions::CreateAccount;

// ---------------------------------------------------------------------------
// Program ID
// ---------------------------------------------------------------------------
declare_id!("CyuzmNggCxLyupt8JBdMdisRn5yo1eUfBPne9BqTnt85");

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const CONFIG_SEED: &[u8] = b"config";
const POOL_SEED: &[u8] = b"pool";

// Fee: 2% (200 basis points)
const FEE_BPS: u64 = 200;

// Initial virtual reserves for bonding curve
const INITIAL_VIRTUAL_LITTER: u64 = 1_000_000_000_000; // 1000 LITTER (6 decimals)
const INITIAL_VIRTUAL_USDC: u64 = 1_000_000_000; // 1000 USDC (6 decimals)

// ---------------------------------------------------------------------------
// State Structures
// ---------------------------------------------------------------------------

/// Config Account (76 bytes)
#[repr(C)]
pub struct Config {
    pub authority: Pubkey,    // 32 bytes
    pub litter_mint: Pubkey,  // 32 bytes  
    pub fee_bps: u64,         // 8 bytes
}

/// Pool Account (40 bytes)
#[repr(C)]
pub struct Pool {
    pub virtual_litter: u64, // 8 bytes
    pub virtual_usdc: u64,   // 8 bytes
    pub real_litter: u64,    // 8 bytes
    pub real_usdc: u64,      // 8 bytes
    pub is_active: u8,       // 1 byte
    pub _padding: [u8; 7],   // 7 bytes
}

// ---------------------------------------------------------------------------
// Entry Point
// ---------------------------------------------------------------------------

entrypoint!(process_instruction);

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    data: &[u8],
) -> ProgramResult {
    match data.split_first() {
        Some((&0, _rest)) => process_initialize(program_id, accounts),
        Some((&1, _rest)) => process_swap(program_id, accounts),
        Some((&2, _rest)) => process_withdraw(program_id, accounts),
        _ => Err(ProgramError::InvalidInstructionData),
    }
}

// ---------------------------------------------------------------------------
// Initialize Instruction
// ---------------------------------------------------------------------------

fn process_initialize(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {
    // Expected accounts:
    // 0. [signer, writable] authority
    // 1. [writable] config_pda
    // 2. [writable] pool_pda
    // 3. [writable] litter_mint

    if accounts.len() < 4 {
        return Err(ProgramError::NotEnoughAccountKeys);
    }

    let authority = &accounts[0];
    let config_acc = &accounts[1];
    let pool_acc = &accounts[2];
    let litter_mint_acc = &accounts[3];

    // Validate authority is signer
    if !authority.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Derive and validate Config PDA
    let (expected_config, config_bump) = pubkey::find_program_address(&[CONFIG_SEED], program_id);
    if config_acc.key() != &expected_config {
        return Err(ProgramError::InvalidAccountData);
    }

    // Derive and validate Pool PDA
    let (expected_pool, pool_bump) = pubkey::find_program_address(&[POOL_SEED], program_id);
    if pool_acc.key() != &expected_pool {
        return Err(ProgramError::InvalidAccountData);
    }

    // Create Config Account using PDA signer
    {
        let bump = [config_bump];
        let seeds = [Seed::from(CONFIG_SEED), Seed::from(&bump)];
        let signer = Signer::from(&seeds);
        
        CreateAccount {
            from: authority,
            to: config_acc,
            lamports: 1_000_000u64,
            space: 76u64,
            owner: program_id,
        }.invoke_signed(&[signer]).ok();
    }

    // Create Pool Account using PDA signer
    {
        let bump = [pool_bump];
        let seeds = [Seed::from(POOL_SEED), Seed::from(&bump)];
        let signer = Signer::from(&seeds);
        
        CreateAccount {
            from: authority,
            to: pool_acc,
            lamports: 1_000_000u64,
            space: 40u64,
            owner: program_id,
        }.invoke_signed(&[signer]).ok();
    }

    // Initialize Config Account data
    {
        let litter_mint_key = *litter_mint_acc.key();
        let config_data = unsafe { config_acc.borrow_mut_data_unchecked() };
        
        config_data[0..32].copy_from_slice(authority.key().as_ref());
        config_data[32..64].copy_from_slice(litter_mint_key.as_ref());
        config_data[64..72].copy_from_slice(&FEE_BPS.to_le_bytes());
    }

    // Initialize Pool Account data
    {
        let pool_data = unsafe { pool_acc.borrow_mut_data_unchecked() };
        
        pool_data[0..8].copy_from_slice(&INITIAL_VIRTUAL_LITTER.to_le_bytes());
        pool_data[8..16].copy_from_slice(&INITIAL_VIRTUAL_USDC.to_le_bytes());
        pool_data[16..24].copy_from_slice(&0u64.to_le_bytes()); // real_litter = 0
        pool_data[24..32].copy_from_slice(&0u64.to_le_bytes()); // real_usdc = 0
        pool_data[32] = 1; // is_active = true
        // Padding is already zero
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// Swap Instruction
// ---------------------------------------------------------------------------

fn process_swap(
    _program_id: &Pubkey,
    _accounts: &[AccountInfo],
) -> ProgramResult {
    // TODO: Implement
    Ok(())
}

// ---------------------------------------------------------------------------
// Withdraw Instruction
// ---------------------------------------------------------------------------

fn process_withdraw(
    _program_id: &Pubkey,
    _accounts: &[AccountInfo],
) -> ProgramResult {
    // TODO: Implement
    Ok(())
}

// ---------------------------------------------------------------------------
// Panic Handler
// ---------------------------------------------------------------------------

#[panic_handler]
fn panic(_: &core::panic::PanicInfo<'_>) -> ! {
    loop {}
}
