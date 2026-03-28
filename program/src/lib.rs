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
const INITIAL_VIRTUAL_LITTER: u64 = 1_000_000_000_000; // 1000 tokens (12 decimals)
const INITIAL_VIRTUAL_SOL: u64 = 1_000_000_000_000;    // 1000 SOL (in lamports)

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
        pool_data[16..24].copy_from_slice(&0u64.to_le_bytes());
        pool_data[24..32].copy_from_slice(&0u64.to_le_bytes());
        pool_data[32] = 0;
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// Deposit Instruction (SOL → LITTER)
// ---------------------------------------------------------------------------
fn process_deposit(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    data: &[u8],
) -> ProgramResult {
    // Expected accounts:
    // 0. [signer, writable] user
    // 1. [writable] config_pda
    // 2. [writable] pool_pda
    // 3. [writable] user_litter_ata
    // 4. [writable] pool_litter_ata
    // 5. [] litter_mint
    // 6. [] token_program
    
    if accounts.len() < 7 {
        return Err(ProgramError::NotEnoughAccountKeys);
    }

    let user = &accounts[0];
    let config_acc = &accounts[1];
    let pool_acc = &accounts[2];
    let user_litter_ata = &accounts[3];
    let pool_litter_ata = &accounts[4];
    let litter_mint = &accounts[5];
    let token_program = &accounts[6];

    if !user.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }

    if data.len() < 8 {
        return Err(ProgramError::InvalidInstructionData);
    }
    let sol_amount = u64::from_le_bytes(data[0..8].try_into().unwrap());

    let pool_data = unsafe { pool_acc.borrow_data_unchecked() };
    let virtual_litter = u64::from_le_bytes(pool_data[0..8].try_into().unwrap());
    let virtual_sol = u64::from_le_bytes(pool_data[8..16].try_into().unwrap());
    let real_litter = u64::from_le_bytes(pool_data[16..24].try_into().unwrap());
    let real_sol = u64::from_le_bytes(pool_data[24..32].try_into().unwrap());

    // Calculate Litter amount using bonding curve
    let litter_amount = if virtual_sol > 0 {
        (sol_amount * virtual_litter) / (virtual_sol + sol_amount)
    } else {
        (sol_amount * INITIAL_VIRTUAL_LITTER) / INITIAL_VIRTUAL_SOL
    };

    // Calculate 2% fee
    let fee_amount = (litter_amount * FEE_BPS) / FEE_DENOMINATOR;
    let litter_to_user = litter_amount.saturating_sub(fee_amount);

    // Transfer Litter tokens from pool to user
    if litter_to_user > 0 {
        Transfer {
            source: pool_litter_ata,
            destination: user_litter_ata,
            authority: config_acc,
            amount: litter_to_user,
            program_id: None,
        }.invoke()?;
    }

    // Update pool state
    let new_real_sol = real_sol + sol_amount;
    let new_real_litter = real_litter.saturating_sub(litter_to_user);
    let new_is_active = 1u8;

    let pool_data_mut = unsafe { pool_acc.borrow_mut_data_unchecked() };
    pool_data_mut[0..8].copy_from_slice(&virtual_litter.to_le_bytes());
    pool_data_mut[8..16].copy_from_slice(&virtual_sol.to_le_bytes());
    pool_data_mut[16..24].copy_from_slice(&new_real_litter.to_le_bytes());
    pool_data_mut[24..32].copy_from_slice(&new_real_sol.to_le_bytes());
    pool_data_mut[32] = new_is_active;

    Ok(())
}

// ---------------------------------------------------------------------------
// Withdraw Instruction (LITTER → SOL)
// ---------------------------------------------------------------------------
fn process_withdraw(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    data: &[u8],
) -> ProgramResult {
    // Expected accounts:
    // 0. [signer, writable] user
    // 1. [writable] config_pda
    // 2. [writable] pool_pda
    // 3. [writable] user_litter_ata
    // 4. [writable] pool_litter_ata
    // 5. [] litter_mint
    // 6. [] token_program
    
    if accounts.len() < 7 {
        return Err(ProgramError::NotEnoughAccountKeys);
    }

    let user = &accounts[0];
    let config_acc = &accounts[1];
    let pool_acc = &accounts[2];
    let user_litter_ata = &accounts[3];
    let pool_litter_ata = &accounts[4];
    let _litter_mint = &accounts[5];
    let _token_program = &accounts[6];

    if !user.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }

    if data.len() < 8 {
        return Err(ProgramError::InvalidInstructionData);
    }
    let litter_amount = u64::from_le_bytes(data[0..8].try_into().unwrap());

    let pool_data = unsafe { pool_acc.borrow_data_unchecked() };
    let virtual_litter = u64::from_le_bytes(pool_data[0..8].try_into().unwrap());
    let virtual_sol = u64::from_le_bytes(pool_data[8..16].try_into().unwrap());
    let real_litter = u64::from_le_bytes(pool_data[16..24].try_into().unwrap());
    let real_sol = u64::from_le_bytes(pool_data[24..32].try_into().unwrap());
    let is_active = pool_data[32];

    if is_active == 0 {
        return Err(ProgramError::InvalidAccountData);
    }

    // Calculate SOL amount using reverse bonding curve
    let sol_amount = if virtual_litter > 0 {
        (litter_amount * virtual_sol) / (virtual_litter + litter_amount)
    } else {
        0
    };

    // Calculate 2% fee
    let fee_amount = (sol_amount * FEE_BPS) / FEE_DENOMINATOR;
    let sol_to_user = sol_amount.saturating_sub(fee_amount);

    // Transfer Litter tokens from user to pool
    Transfer {
        source: user_litter_ata,
        destination: pool_litter_ata,
        authority: user,
        amount: litter_amount,
        program_id: None,
    }.invoke()?;

    // Update pool state
    let new_real_sol = real_sol.saturating_sub(sol_to_user);
    let new_real_litter = real_litter + litter_amount;

    let pool_data_mut = unsafe { pool_acc.borrow_mut_data_unchecked() };
    pool_data_mut[0..8].copy_from_slice(&virtual_litter.to_le_bytes());
    pool_data_mut[8..16].copy_from_slice(&virtual_sol.to_le_bytes());
    pool_data_mut[16..24].copy_from_slice(&new_real_litter.to_le_bytes());
    pool_data_mut[24..32].copy_from_slice(&new_real_sol.to_le_bytes());

    Ok(())
}

// ---------------------------------------------------------------------------
// Panic Handler
// ---------------------------------------------------------------------------
#[panic_handler]
fn panic(_: &core::panic::PanicInfo<'_>) -> ! {
    loop {}
}
