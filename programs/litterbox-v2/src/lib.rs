use anchor_lang::prelude::*;
use anchor_spl::{
    token::{self, Token, TokenAccount, Transfer, Mint, transfer},
    associated_token::AssociatedToken,
};

declare_id!("AX6vgdmqDXRVd3kNwT8Xt7B49GcDTDFR4LwV7caxmZCG");

pub mod errors {
    use anchor_lang::prelude::*;

    #[error_code]
    pub enum LitterError {
        #[msg("Invalid amount provided")]
        InvalidAmount,
        #[msg("Slippage tolerance exceeded")]
        SlippageExceeded,
        #[msg("Graduation threshold not yet met")]
        ThresholdNotMet,
        #[msg("Protocol already graduated")]
        AlreadyGraduated,
        #[msg("Protocol not yet graduated")]
        NotGraduated,
        #[msg("Unauthorized")]
        Unauthorized,
        #[msg("No USDC received from swap")]
        NoUsdcReceived,
        #[msg("Deposit too small")]
        DepositTooSmall,
        #[msg("Sweep too small")]
        SweepTooSmall,
        #[msg("Math overflow")]
        MathOverflow,
        #[msg("Token validation failed")]
        TokenValidationFailed,
        #[msg("Invalid Raydium program")]
        InvalidRaydiumProgram,
        #[msg("Invalid pool owner")]
        InvalidPoolOwner,
        #[msg("Insufficient vault balance")]
        InsufficientVaultBalance,
    }
}

pub mod state {
    use anchor_lang::prelude::*;

    #[account]
    pub struct Config {
        pub authority: Pubkey,
        pub litter_mint: Pubkey,
        pub usdc_mint: Pubkey,
        pub usdc_vault: Pubkey,
        pub litter_vault: Pubkey,
        pub graduation_threshold: u64,
        pub pool_mode: u8, // 0=Virtual, 1=Real
        pub real_pool_address: Pubkey,
        pub bump: u8,
    }

    #[account]
    pub struct VirtualPool {
        pub virtual_usdc_reserve: u64,
        pub virtual_litter_reserve: u64,
        pub accumulated_usdc: u64,
        pub total_litter_distributed: u64,
        pub bump: u8,
    }

    pub const CONFIG_SEED: &[u8] = b"config";
    pub const VIRTUAL_POOL_SEED: &[u8] = b"virtual_pool";
    pub const USDC_VAULT_SEED: &[u8] = b"usdc_vault";
    pub const LITTER_VAULT_SEED: &[u8] = b"litter_vault";
    
    pub const RAYDIUM_CPMM_MAINNET: &str = "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C";
    pub const RAYDIUM_CPMM_DEVNET: &str = "CPMDWBwJDtYax9qW7AyRuVC19Cc4L4Vcy4n2BHAbHkCW";

    pub enum PoolMode {
        Virtual = 0,
        Real = 1,
    }
}

pub mod utils {
    use crate::errors::LitterError;
    use anchor_lang::prelude::*;

    /// Calculate $LITTER output using constant product bonding curve
    pub fn calculate_litter_out(
        usdc_in: u64,
        virtual_usdc: u64,
        virtual_litter: u64,
    ) -> Result<u64> {
        if virtual_usdc == 0 || virtual_litter == 0 {
            return Ok(0);
        }

        let numerator = (virtual_litter as u128)
            .checked_mul(usdc_in as u128)
            .ok_or(LitterError::MathOverflow)?;
        let denominator = (virtual_usdc as u128)
            .checked_add(usdc_in as u128)
            .ok_or(LitterError::MathOverflow)?;

        Ok((numerator / denominator) as u64)
    }

    /// Calculate spot price: virtual_usdc / virtual_litter
    pub fn spot_price_scaled(virtual_usdc: u64, virtual_litter: u64) -> Option<u128> {
        if virtual_litter == 0 {
            return None;
        }
        let price = (virtual_usdc as u128)
            .checked_mul(1_000_000_000_000)?
            .checked_div(virtual_litter as u128)?;
        Some(price)
    }
}

#[program]
pub mod litterbox_v2 {
    use super::*;
    use crate::errors::LitterError;
    use crate::state::*;
    use crate::utils::*;

    /// Initializes the protocol
    pub fn initialize(ctx: Context<Initialize>, params: InitializeParams) -> Result<()> {
        let config = &mut ctx.accounts.config;
        let pool = &mut ctx.accounts.virtual_pool;

        config.authority = ctx.accounts.authority.key();
        config.litter_mint = ctx.accounts.litter_mint.key();
        config.usdc_mint = ctx.accounts.usdc_mint.key();
        config.usdc_vault = ctx.accounts.usdc_vault.key();
        config.litter_vault = ctx.accounts.litter_vault.key();
        config.graduation_threshold = params.graduation_threshold;
        config.pool_mode = state::PoolMode::Virtual as u8;
        config.real_pool_address = Pubkey::default();
        config.bump = 0;
        pool.virtual_usdc_reserve = params.virtual_initial_usdc;
        pool.virtual_litter_reserve = params.virtual_initial_litter;
        pool.accumulated_usdc = 0;
        pool.total_litter_distributed = 0;
        pool.bump = 0;

    let event = Box::new(ProtocolInitialized {
      authority: config.authority,
      litter_mint: config.litter_mint,
      graduation_threshold: config.graduation_threshold,
      virtual_initial_usdc: params.virtual_initial_usdc,
      virtual_initial_litter: params.virtual_initial_litter,
    });
    emit!(*event);
    Ok(())
    }

    /// Deposit any SPL token
    pub fn deposit_any_token(
        ctx: Context<DepositAnyToken>,
        amount_in: u64,
        min_litter_out: u64,
    ) -> Result<()> {
        let config = &ctx.accounts.config;
        let pool = &mut ctx.accounts.virtual_pool;

        const MIN_DEPOSIT_USDC: u64 = 1_000_000;
        require!(amount_in >= MIN_DEPOSIT_USDC, LitterError::DepositTooSmall);

        let usdc_received = amount_in;
        let fee_amount = usdc_received
            .checked_mul(2)
            .unwrap()
            .checked_div(100)
            .unwrap();
        let value_after_fee = usdc_received - fee_amount;

        let litter_out = calculate_litter_out(
            value_after_fee,
            pool.virtual_usdc_reserve,
            pool.virtual_litter_reserve,
        )?;

        require!(litter_out >= min_litter_out, LitterError::SlippageExceeded);

        pool.virtual_usdc_reserve = pool
            .virtual_usdc_reserve
            .checked_add(value_after_fee)
            .ok_or(LitterError::MathOverflow)?;
        pool.virtual_litter_reserve = pool
            .virtual_litter_reserve
            .checked_sub(litter_out)
            .ok_or(LitterError::MathOverflow)?;

        pool.accumulated_usdc = pool
            .accumulated_usdc
            .checked_add(value_after_fee)
            .ok_or(LitterError::MathOverflow)?;
        pool.total_litter_distributed = pool
            .total_litter_distributed
            .checked_add(litter_out)
            .ok_or(LitterError::MathOverflow)?;

        if pool.accumulated_usdc >= config.graduation_threshold {
            emit!(GraduationReady {
                accumulated: pool.accumulated_usdc,
                threshold: config.graduation_threshold,
            });
        }

        emit!(TokenDeposited {
            user: ctx.accounts.user.key(),
            amount_in: amount_in,
            litter_out: litter_out,
            fee_amount: fee_amount,
        });

        Ok(())
    }

    /// Permissionless sweep
    pub fn sweep_and_swap(ctx: Context<SweepAndSwap>) -> Result<()> {
        let usdc_vault = &ctx.accounts.usdc_vault;
        let virtual_pool = &mut ctx.accounts.virtual_pool;

        let usdc_balance_now = usdc_vault.amount;
        let previously_accumulated = virtual_pool.accumulated_usdc;
        
        let usdc_gained = usdc_balance_now
            .checked_sub(previously_accumulated)
            .ok_or(LitterError::NoUsdcReceived)?;

        const MIN_SWEEP_USDC: u64 = 100_000;
        require!(usdc_gained >= MIN_SWEEP_USDC, LitterError::SweepTooSmall);
        require!(usdc_gained > 0, LitterError::NoUsdcReceived);

        virtual_pool.accumulated_usdc = virtual_pool
            .accumulated_usdc
            .checked_add(usdc_gained)
            .ok_or(LitterError::MathOverflow)?;

        msg!(
            "Sweep complete: {} USDC collected. Total accumulated: {} USDC.",
            usdc_gained,
            virtual_pool.accumulated_usdc
        );

        Ok(())
    }

    /// Graduate to real Raydium pool
    pub fn graduate_to_real(
        ctx: Context<GraduateToReal>,
        usdc_amount: u64,
        litter_amount: u64,
    ) -> Result<()> {
        let virtual_pool = &ctx.accounts.virtual_pool;
        let config = &mut ctx.accounts.config;

        require!(
            virtual_pool.accumulated_usdc >= config.graduation_threshold,
            LitterError::ThresholdNotMet
        );
        require!(
            config.pool_mode == state::PoolMode::Virtual as u8,
            LitterError::AlreadyGraduated
        );

        require!(
            usdc_amount > 0 && usdc_amount <= ctx.accounts.usdc_vault.amount,
            LitterError::InsufficientVaultBalance
        );
        require!(
            litter_amount > 0 && litter_amount <= ctx.accounts.litter_vault.amount,
            LitterError::InsufficientVaultBalance
        );

        let raydium_pool_owner = ctx.accounts.raydium_pool.owner;
        let cpmm_program_id = ctx.accounts.raydium_cpmm_program.key();
        require!(
            *raydium_pool_owner == cpmm_program_id,
            LitterError::InvalidPoolOwner
        );

        let vault_bump = ctx.bumps.vault_authority;
        let seeds: &[&[u8]] = &[LITTER_VAULT_SEED, &[vault_bump]];
        let signer_seeds = &[seeds];

        let usdc_cpi = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.usdc_vault.to_account_info(),
                to: ctx.accounts.raydium_usdc_vault.to_account_info(),
                authority: ctx.accounts.vault_authority.to_account_info(),
            },
            signer_seeds,
        );
        transfer(usdc_cpi, usdc_amount)?;

        let litter_cpi = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.litter_vault.to_account_info(),
                to: ctx.accounts.raydium_litter_vault.to_account_info(),
                authority: ctx.accounts.vault_authority.to_account_info(),
            },
            signer_seeds,
        );
        transfer(litter_cpi, litter_amount)?;

        config.pool_mode = state::PoolMode::Real as u8;
        config.real_pool_address = ctx.accounts.raydium_pool.key();

        msg!(
            "Graduated! Pool: {}. USDC seeded: {}. LITTER seeded: {}.",
            ctx.accounts.raydium_pool.key(),
            usdc_amount,
            litter_amount,
        );

        emit!(ProtocolGraduated {
            pool_mode: config.pool_mode,
            pool_address: config.real_pool_address,
        });

        Ok(())
    }

    /// Flush remaining liquidity to Raydium pool
    pub fn flush_to_lp(
        ctx: Context<FlushToLp>,
        usdc_amount: u64,
        litter_amount: u64,
    ) -> Result<()> {
        require!(
            usdc_amount <= ctx.accounts.usdc_vault.amount,
            LitterError::InsufficientVaultBalance
        );
        require!(
            litter_amount <= ctx.accounts.litter_vault.amount,
            LitterError::InsufficientVaultBalance
        );
        require!(
            usdc_amount > 0 || litter_amount > 0,
            LitterError::InvalidAmount
        );

        let vault_bump = ctx.bumps.vault_authority;
        let seeds: &[&[u8]] = &[LITTER_VAULT_SEED, &[vault_bump]];
        let signer_seeds = &[seeds];

        if usdc_amount > 0 {
            let cpi = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.usdc_vault.to_account_info(),
                    to: ctx.accounts.raydium_usdc_vault.to_account_info(),
                    authority: ctx.accounts.vault_authority.to_account_info(),
                },
                signer_seeds,
            );
            transfer(cpi, usdc_amount)?;
        }

        if litter_amount > 0 {
            let cpi = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.litter_vault.to_account_info(),
                    to: ctx.accounts.raydium_litter_vault.to_account_info(),
                    authority: ctx.accounts.vault_authority.to_account_info(),
                },
                signer_seeds,
            );
            transfer(cpi, litter_amount)?;
        }

        msg!(
            "Flush to LP: {} USDC + {} LITTER added to Raydium pool {}.",
            usdc_amount,
            litter_amount,
            ctx.accounts.config.real_pool_address,
        );

        Ok(())
    }
}

// --- Contexts ---

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = authority, space = 8 + 202)]
    pub config: Account<'info, state::Config>,
    #[account(init, payer = authority, space = 8 + 41)]
    pub virtual_pool: Account<'info, state::VirtualPool>,
    #[account(
        init,
        payer = authority,
        associated_token::mint = usdc_mint,
        associated_token::authority = config
    )]
    pub usdc_vault: Account<'info, TokenAccount>,
    #[account(
        init,
        payer = authority,
        associated_token::mint = litter_mint,
        associated_token::authority = config
    )]
    pub litter_vault: Account<'info, TokenAccount>,
    pub litter_mint: Account<'info, Mint>,
    pub usdc_mint: Account<'info, Mint>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(Accounts)]
pub struct DepositAnyToken<'info> {
    #[account(mut)]
    pub config: Account<'info, state::Config>,
    #[account(mut)]
    pub virtual_pool: Account<'info, state::VirtualPool>,
    #[account(mut)]
    pub litter_vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct SweepAndSwap<'info> {
    #[account(mut)]
    pub caller: Signer<'info>,
    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
        constraint = config.pool_mode == state::PoolMode::Virtual as u8 @ LitterError::AlreadyGraduated,
    )]
    pub config: Account<'info, state::Config>,
    #[account(
        mut,
        seeds = [VIRTUAL_POOL_SEED],
        bump = virtual_pool.bump,
    )]
    pub virtual_pool: Account<'info, state::VirtualPool>,
    #[account(
        mut,
        address = config.usdc_vault @ LitterError::NoUsdcReceived,
    )]
    pub usdc_vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct GraduateToReal<'info> {
    #[account(mut)]
    pub caller: Signer<'info>,
    #[account(
        mut,
        seeds = [CONFIG_SEED],
        bump = config.bump,
        constraint = config.pool_mode == state::PoolMode::Virtual as u8 @ LitterError::AlreadyGraduated,
    )]
    pub config: Account<'info, state::Config>,
    #[account(
        seeds = [VIRTUAL_POOL_SEED],
        bump = virtual_pool.bump,
    )]
    pub virtual_pool: Account<'info, state::VirtualPool>,
    #[account(
        mut,
        address = config.usdc_vault @ LitterError::NoUsdcReceived,
    )]
    pub usdc_vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        address = config.litter_vault @ LitterError::InsufficientVaultBalance,
    )]
    pub litter_vault: Account<'info, TokenAccount>,
    /// CHECK: PDA used for signing vault authority
  #[account(
    seeds = [LITTER_VAULT_SEED],
    bump,
  )]
  pub vault_authority: UncheckedAccount<'info>,
    /// CHECK: Raydium USDC vault - verified by Raydium program
    #[account(mut)]
    pub raydium_usdc_vault: UncheckedAccount<'info>,
    /// CHECK: Raydium LITTER vault - verified by Raydium program
    #[account(mut)]
    pub raydium_litter_vault: UncheckedAccount<'info>,
    /// CHECK: Raydium pool account - verified by Raydium program
    #[account(mut)]
    pub raydium_pool: UncheckedAccount<'info>,
    /// CHECK: Raydium CPMM program - verified by constraint
    #[account(
        constraint = (
            raydium_cpmm_program.key().to_string() == crate::state::RAYDIUM_CPMM_MAINNET ||
            raydium_cpmm_program.key().to_string() == crate::state::RAYDIUM_CPMM_DEVNET
        ) @ LitterError::InvalidRaydiumProgram,
    )]
    pub raydium_cpmm_program: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FlushToLp<'info> {
    #[account(mut)]
    pub caller: Signer<'info>,
    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
        constraint = config.pool_mode == state::PoolMode::Real as u8 @ LitterError::NotGraduated,
    )]
    pub config: Account<'info, state::Config>,
    #[account(
        mut,
        address = config.usdc_vault @ LitterError::NoUsdcReceived,
    )]
    pub usdc_vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        address = config.litter_vault @ LitterError::InsufficientVaultBalance,
    )]
    pub litter_vault: Account<'info, TokenAccount>,
    /// CHECK: PDA used for signing vault authority
  #[account(
    seeds = [LITTER_VAULT_SEED],
    bump,
  )]
  pub vault_authority: UncheckedAccount<'info>,
    /// CHECK: Raydium USDC vault - verified by Raydium program
    #[account(mut)]
    pub raydium_usdc_vault: UncheckedAccount<'info>,
    /// CHECK: Raydium LITTER vault - verified by Raydium program
    #[account(mut)]
    pub raydium_litter_vault: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
}

// --- Events ---

#[event]
pub struct ProtocolInitialized {
    pub authority: Pubkey,
    pub litter_mint: Pubkey,
    pub graduation_threshold: u64,
    pub virtual_initial_usdc: u64,
    pub virtual_initial_litter: u64,
}

#[event]
pub struct TokenDeposited {
    pub user: Pubkey,
    pub amount_in: u64,
    pub litter_out: u64,
    pub fee_amount: u64,
}

#[event]
pub struct GraduationReady {
    pub accumulated: u64,
    pub threshold: u64,
}

#[event]
pub struct ProtocolGraduated {
    pub pool_mode: u8,
    pub pool_address: Pubkey,
}

// --- Constants ---

pub const MIN_DEPOSIT_USDC: u64 = 1_000_000;
pub const MIN_SWEEP_USDC: u64 = 100_000;
pub const PLATFORM_FEE_BPS: u16 = 200;

// --- Params Struct ---

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeParams {
    pub graduation_threshold: u64,
    pub virtual_initial_usdc: u64,
    pub virtual_initial_litter: u64,
}

// --- Re-exports ---

pub use errors::LitterError;
pub use state::{Config, VirtualPool, CONFIG_SEED, LITTER_VAULT_SEED, VIRTUAL_POOL_SEED};
