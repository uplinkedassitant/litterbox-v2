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
// 1000 LITTER tokens (6 decimals)
const INITIAL_VIRTUAL_LITTER: u64 = 1_000_000_000_000;
// 1000 SOL (9 decimals - lamports)
const INITIAL_VIRTUAL_SOL: u64 = 1_000_000_000_000;

// ---------------------------------------------------------------------------
// State Structures
// ---------------------------------------------------------------------------

/// Config Account (76 bytes)
#[repr(C)]
pub struct Config {
    pub authority: Pubkey,    // 32 bytes
    pub litter_mint: Pubkey,  // 32 bytes
    pub fee_bps: u64,         // 8 bytes
    pub _padding: [u8; 4],    // 4 bytes padding
}

/// Pool Account (40 bytes)
#[repr(C)]
pub struct Pool {
    pub virtual_litter: u64,  // 8 bytes
    pub virtual_sol: u64,     // 8 bytes - was virtual_usdc
    pub real_litter: u64,     // 8 bytes
    pub real_sol: u64,        // 8 bytes - was real_usdc
    pub is_active: u8,        // 1 byte
    pub _padding: [u8; 7],    // 7 bytes
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
        Some((&1, rest)) => process_deposit(program_id, accounts, rest),
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
    if accounts.len() < 5 {
        return Err(ProgramError::NotEnoughAccountKeys);
    }

    let authority = &accounts[0];
    let config_acc = &accounts[1];
    let pool_acc = &accounts[2];
    let litter_mint_acc = &accounts[3];
    let _system_program = &accounts[4];

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
            lamports: 100_000_000u64,
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
            lamports: 100_000_000u64,
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
        pool_data[8..16].copy_from_slice(&INITIAL_VIRTUAL_SOL.to_le_bytes());
        pool_data[16..24].copy_from_slice(&0u64.to_le_bytes());  // real_litter = 0
        pool_data[24..32].copy_from_slice(&0u64.to_le_bytes());  // real_sol = 0
        pool_data[32] = 0;  // is_active = false (activates on first deposit)
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// Deposit Instruction (SOL → LITTER)
// ---------------------------------------------------------------------------
fn process_deposit(
    _program_id: &Pubkey,
    accounts: &[AccountInfo],
    data: &[u8],
) -> ProgramResult {
    // Expected accounts:
    // 0. [signer, writable] user
    // 1. [writable] config_pda
    // 2. [writable] pool_pda
    // 3. [writable] user_litter_ata
    // 4. [] litter_mint
    // 5. [] token_program
    
    if accounts.len() < 6 {
        return Err(ProgramError::NotEnoughAccountKeys);
    }

    let user = &accounts[0];
    let config_acc = &accounts[1];
    let pool_acc = &accounts[2];
    let user_litter_ata = &accounts[3];
    let litter_mint = &accounts[4];
    let token_program = &accounts[5];

    // Validate user is signer
    if !user.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Parse instruction data: sol_amount in lamports (u64 LE)
    if data.len() < 8 {
        return Err(ProgramError::InvalidInstructionData);
    }
    let sol_amount = u64::from_le_bytes(data[0..8].try_into().unwrap());

    // Read pool state
    let pool_data = unsafe { pool_acc.borrow_data_unchecked() };
    let virtual_litter = u64::from_le_bytes(pool_data[0..8].try_into().unwrap());
    let virtual_sol = u64::from_le_bytes(pool_data[8..16].try_into().unwrap());
    let real_litter = u64::from_le_bytes(pool_data[16..24].try_into().unwrap());
    let real_sol = u64::from_le_bytes(pool_data[24..32].try_into().unwrap());
    let is_active = pool_data[32];

    // Calculate Litter amount using bonding curve
    // Formula: litter_out = (sol_in * virtual_litter) / (virtual_sol + sol_in)
    let litter_amount = if virtual_sol > 0 {
        (sol_amount * virtual_litter) / (virtual_sol + sol_amount)
    } else {
        // First deposit: use initial ratio
        (sol_amount * INITIAL_VIRTUAL_LITTER) / INITIAL_VIRTUAL_SOL
    };

    // Calculate 2% fee
    let fee_amount = (litter_amount * FEE_BPS) / FEE_DENOMINATOR;
    let litter_to_user = litter_amount.saturating_sub(fee_amount);

    // For initial version, we'll just track the deposit in pool state
    // Token transfers will be handled separately or in a future version
    
    // Update pool state - track the SOL deposit
    let new_real_sol = real_sol + sol_amount;
    let new_is_active = 1u8;  // Activate on first deposit

    let pool_data_mut = unsafe { pool_acc.borrow_mut_data_unchecked() };
    pool_data_mut[0..8].copy_from_slice(&virtual_litter.to_le_bytes());
    pool_data_mut[8..16].copy_from_slice(&virtual_sol.to_le_bytes());
    pool_data_mut[16..24].copy_from_slice(&real_litter.to_le_bytes());  // Keep same
    pool_data_mut[24..32].copy_from_slice(&new_real_sol.to_le_bytes());
    pool_data_mut[32] = new_is_active;

    Ok(())
}

// ---------------------------------------------------------------------------
// Withdraw Instruction (LITTER → SOL)
// ---------------------------------------------------------------------------
fn process_withdraw(
    _program_id: &Pubkey,
    accounts: &[AccountInfo],
    data: &[u8],
) -> ProgramResult {
    // Expected accounts:
    // 0. [signer, writable] user
    // 1. [writable] config_pda
    // 2. [writable] pool_pda
    // 3. [writable] user_litter_ata
    // 4. [] litter_mint
    // 5. [] token_program
    
    if accounts.len() < 6 {
        return Err(ProgramError::NotEnoughAccountKeys);
    }

    let user = &accounts[0];
    let config_acc = &accounts[1];
    let pool_acc = &accounts[2];
    let user_litter_ata = &accounts[3];
    let _litter_mint = &accounts[4];
    let token_program = &accounts[5];

    // Validate user is signer
    if !user.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Parse instruction data: litter_amount (u64 LE)
    if data.len() < 8 {
        return Err(ProgramError::InvalidInstructionData);
    }
    let litter_amount = u64::from_le_bytes(data[0..8].try_into().unwrap());

    // Read pool state
    let pool_data = unsafe { pool_acc.borrow_data_unchecked() };
    let virtual_litter = u64::from_le_bytes(pool_data[0..8].try_into().unwrap());
    let virtual_sol = u64::from_le_bytes(pool_data[8..16].try_into().unwrap());
    let real_litter = u64::from_le_bytes(pool_data[16..24].try_into().unwrap());
    let real_sol = u64::from_le_bytes(pool_data[24..32].try_into().unwrap());
    let is_active = pool_data[32];

    // Validate pool is active
    if is_active == 0 {
        return Err(ProgramError::InvalidAccountData);
    }

    // Calculate SOL amount using reverse bonding curve
    // Formula: sol_out = (litter_in * virtual_sol) / (virtual_litter + litter_in)
    let sol_amount = if virtual_litter > 0 {
        (litter_amount * virtual_sol) / (virtual_litter + litter_amount)
    } else {
        0
    };

    // Calculate 2% fee
    let fee_amount = (sol_amount * FEE_BPS) / FEE_DENOMINATOR;
    let sol_to_user = sol_amount.saturating_sub(fee_amount);

    // Transfer Litter from user to pool
    Transfer {
        source: user_litter_ata,
        destination: user_litter_ata,  // Should be pool's litter ATA
        authority: user,
        amount: litter_amount,
        program_id: None,
    }.invoke()?;

    // Transfer SOL from pool to user (native transfer)
    // This will be handled by the runtime via the instruction's lamports

    // Update pool state
    let new_real_sol = real_sol.saturating_sub(sol_to_user);
    let new_real_litter = real_litter + litter_amount;

    let pool_data_mut = unsafe { pool_acc.borrow_mut_data_unchecked() };
    pool_data_mut[0..8].copy_from_slice(&virtual_litter.to_le_bytes());
    pool_data_mut[8..16].copy_from_slice(&virtual_sol.to_le_bytes());
    pool_data_mut[16..24].copy_from_slice(&new_real_litter.to_le_bytes());
    pool_data_mut[24..32].copy_from_slice(&new_real_sol.to_le_bytes());
    // Pool remains active

    Ok(())
}

// ---------------------------------------------------------------------------
// Panic Handler
// ---------------------------------------------------------------------------
#[panic_handler]
fn panic(_: &core::panic::PanicInfo<'_>) -> ! {
    loop {}
}
