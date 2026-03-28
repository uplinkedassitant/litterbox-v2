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
use pinocchio_tkn::common::Transfer;

// ---------------------------------------------------------------------------
// Program ID
// ---------------------------------------------------------------------------
declare_id!("CyuzmNggCxLyupt8JBdMdisRn5yo1eUfBPne9BqTnt85");

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const CONFIG_SEED: &[u8] = b"config";
const POOL_SEED: &[u8] = b"pool";

// Fee: 2% (200 basis points, denominator 10000)
const FEE_BPS: u64 = 200;
const FEE_DENOMINATOR: u64 = 10000;

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
        Some((&1, rest)) => process_swap(program_id, accounts, rest),
        Some((&2, rest)) => process_withdraw(program_id, accounts, rest),
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
    if accounts.len() < 4 {
        return Err(ProgramError::NotEnoughAccountKeys);
    }

    let authority = &accounts[0];
    let config_acc = &accounts[1];
    let pool_acc = &accounts[2];
    let litter_mint_acc = &accounts[3];

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

    // Create Config Account
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

    // Create Pool Account
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

    // Initialize Config data
    {
        let litter_mint_key = *litter_mint_acc.key();
        let config_data = unsafe { config_acc.borrow_mut_data_unchecked() };
        
        config_data[0..32].copy_from_slice(authority.key().as_ref());
        config_data[32..64].copy_from_slice(litter_mint_key.as_ref());
        config_data[64..72].copy_from_slice(&FEE_BPS.to_le_bytes());
    }

    // Initialize Pool data
    {
        let pool_data = unsafe { pool_acc.borrow_mut_data_unchecked() };
        
        pool_data[0..8].copy_from_slice(&INITIAL_VIRTUAL_LITTER.to_le_bytes());
        pool_data[8..16].copy_from_slice(&INITIAL_VIRTUAL_USDC.to_le_bytes());
        pool_data[16..24].copy_from_slice(&0u64.to_le_bytes()); // real_litter = 0
        pool_data[24..32].copy_from_slice(&0u64.to_le_bytes()); // real_usdc = 0
        pool_data[32] = 0; // is_active = false (activates on first deposit)
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// Swap Instruction (USDC → LITTER)
// ---------------------------------------------------------------------------

fn process_swap(
    _program_id: &Pubkey,
    accounts: &[AccountInfo],
    data: &[u8],
) -> ProgramResult {
    // Expected accounts:
    // 0. [signer, writable] user
    // 1. [writable] config_pda
    // 2. [writable] pool_pda
    // 3. [writable] user_usdc_ata
    // 4. [writable] pool_usdc_ata
    // 5. [writable] user_litter_ata
    // 6. [] litter_mint
    // 7. [] token_program

    if accounts.len() < 8 {
        return Err(ProgramError::NotEnoughAccountKeys);
    }

    let user = &accounts[0];
    let config_acc = &accounts[1];
    let pool_acc = &accounts[2];
    let user_usdc_ata = &accounts[3];
    let pool_usdc_ata = &accounts[4];
    let user_litter_ata = &accounts[5];
    let litter_mint = &accounts[6];
    let token_program = &accounts[7];

    // Validate user is signer
    if !user.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Parse instruction data: usdc_amount (u64 LE)
    if data.len() < 8 {
        return Err(ProgramError::InvalidInstructionData);
    }
    let usdc_amount = u64::from_le_bytes(data[0..8].try_into().unwrap());

    // Read pool state
    let pool_data = unsafe { pool_acc.borrow_data_unchecked() };
    let virtual_litter = u64::from_le_bytes(pool_data[0..8].try_into().unwrap());
    let virtual_usdc = u64::from_le_bytes(pool_data[8..16].try_into().unwrap());
    let real_litter = u64::from_le_bytes(pool_data[16..24].try_into().unwrap());
    let real_usdc = u64::from_le_bytes(pool_data[24..32].try_into().unwrap());
    let is_active = pool_data[32];

    // Calculate Litter amount using bonding curve
    // Formula: litter_out = (usdc_in * virtual_litter) / (virtual_usdc + usdc_in)
    let litter_amount = if virtual_usdc > 0 {
        (usdc_amount * virtual_litter) / (virtual_usdc + usdc_amount)
    } else {
        // First deposit: use initial ratio
        (usdc_amount * INITIAL_VIRTUAL_LITTER) / INITIAL_VIRTUAL_USDC
    };

    // Calculate 2% fee
    let fee_amount = (litter_amount * FEE_BPS) / FEE_DENOMINATOR;
    let litter_to_user = litter_amount.saturating_sub(fee_amount);

    // Transfer USDC from user to pool (already done by Jupiter, but we track it)
    Transfer {
        source: user_usdc_ata,
        destination: pool_usdc_ata,
        authority: user,
        amount: usdc_amount,
        program_id: None,
    }.invoke()?;

    // Mint Litter to user (or transfer from pool if pre-minted)
    // For now, we'll use Transfer assuming tokens are in pool
    // In production, you might want to mint on-the-fly
    Transfer {
        source: user_litter_ata, // This should be pool's litter ata
        destination: user_litter_ata,
        authority: config_acc, // Pool authority
        amount: litter_to_user,
        program_id: None,
    }.invoke()?;

    // Update pool state
    let new_real_usdc = real_usdc.saturating_add(usdc_amount);
    let new_real_litter = real_litter.saturating_sub(litter_to_user);
    
    let pool_data_mut = unsafe { pool_acc.borrow_mut_data_unchecked() };
    pool_data_mut[0..8].copy_from_slice(&virtual_litter.to_le_bytes());
    pool_data_mut[8..16].copy_from_slice(&virtual_usdc.to_le_bytes());
    pool_data_mut[16..24].copy_from_slice(&new_real_litter.to_le_bytes());
    pool_data_mut[24..32].copy_from_slice(&new_real_usdc.to_le_bytes());
    pool_data_mut[32] = 1; // Activate pool

    Ok(())
}

// ---------------------------------------------------------------------------
// Withdraw Instruction (LITTER → USDC)
// ---------------------------------------------------------------------------

fn process_withdraw(
    _program_id: &Pubkey,
    _accounts: &[AccountInfo],
    _data: &[u8],
) -> ProgramResult {
    // TODO: Implement withdraw logic
    Ok(())
}

// ---------------------------------------------------------------------------
// Panic Handler
// ---------------------------------------------------------------------------

#[panic_handler]
fn panic(_: &core::panic::PanicInfo<'_>) -> ! {
    loop {}
}
