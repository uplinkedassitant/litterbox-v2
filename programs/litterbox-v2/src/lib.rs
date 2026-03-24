use anchor_lang::prelude::*;
use anchor_spl::{
    token::{self, Token, TokenAccount, Transfer, Mint},
    associated_token::AssociatedToken,
};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS"); // Placeholder - update after first build

#[program]
pub mod litterbox_v2 {
    use super::*;

    /// Initializes the protocol: Config, VirtualPool, and sets up vault
    pub fn initialize(ctx: Context<Initialize>, params: InitializeParams) -> Result<()> {
        let config = &mut ctx.accounts.config;
        let pool = &mut ctx.accounts.virtual_pool;

        // 1. Setup Config
        config.authority = ctx.accounts.authority.key();
        config.litter_mint = ctx.accounts.litter_mint.key();
        config.usdc_mint = ctx.accounts.usdc_mint.key();
        config.vault = ctx.accounts.vault.key();
        config.graduation_threshold = params.graduation_threshold;
        config.pool_mode = PoolMode::Virtual as u8;
        config.real_pool_address = Pubkey::default();
        config.bump = ctx.bumps.config;

        // 2. Setup Virtual Pool
        pool.virtual_usdc_reserve = params.virtual_initial_usdc;
        pool.virtual_litter_reserve = params.virtual_initial_litter;
        pool.accumulated_usdc = 0;
        pool.total_litter_distributed = 0;
        pool.bump = ctx.bumps.virtual_pool;

        emit!(ProtocolInitialized {
            authority: config.authority,
            litter_mint: config.litter_mint,
            graduation_threshold: config.graduation_threshold,
            virtual_initial_usdc: params.virtual_initial_usdc,
            virtual_initial_litter: params.virtual_initial_litter,
        });

        Ok(())
    }

    /// Core Instruction: Deposit ANY SPL Token
    /// Flow: Swap to USDC (via Jupiter) -> Apply 2% Fee -> Calculate $LITTER (Bonding Curve) -> Distribute
    pub fn deposit_any_token(
        ctx: Context<DepositAnyToken>,
        amount_in: u64,
        min_litter_out: u64,
    ) -> Result<()> {
        let config = &ctx.accounts.config;
        let pool = &mut ctx.accounts.virtual_pool;
        
        // 1. Validate Minimum Deposit (Anti-spam) - Simplified for Phase 1
        require!(amount_in > 0, LitterError::InvalidAmount);

        // 2. Transfer User's Token to Program's PendingSwap Account
        // (In Phase 2: This triggers Jupiter CPI to swap to USDC)
        // For Phase 1, we simulate: assume amount_in is already in USDC value
        let usdc_received = amount_in; // Placeholder

        // 3. Calculate 2% Platform Fee
        let fee_amount = usdc_received
            .checked_mul(2)
            .unwrap()
            .checked_div(100)
            .unwrap();
        let value_after_fee = usdc_received - fee_amount;

        // 4. Calculate $LITTER Output using Bonding Curve
        // Formula: out = (reserve_litter * value_in) / (reserve_usdc + value_in)
        let litter_out = if pool.virtual_usdc_reserve > 0 && pool.virtual_litter_reserve > 0 {
            let numerator = (pool.virtual_litter_reserve as u128)
                .checked_mul(value_after_fee as u128)
                .unwrap();
            let denominator = (pool.virtual_usdc_reserve as u128)
                .checked_add(value_after_fee as u128)
                .unwrap();
            
            let amount = (numerator / denominator) as u64;
            
            // Update Virtual Reserves
            pool.virtual_usdc_reserve = pool
                .virtual_usdc_reserve
                .checked_add(value_after_fee)
                .unwrap();
            pool.virtual_litter_reserve = pool
                .virtual_litter_reserve
                .checked_sub(amount)
                .unwrap();
            
            amount
        } else {
            0
        };

        // 5. Slippage Check
        require!(litter_out >= min_litter_out, LitterError::SlippageExceeded);

        // 6. Transfer $LITTER from Vault to User
        // (In Phase 2: Use CPI to transfer from vault PDA to user)
        // token::transfer(ctx.accounts.transfer_ctx(), litter_out)?;

        // 7. Accumulate USDC (simulated)
        pool.accumulated_usdc = pool
            .accumulated_usdc
            .checked_add(value_after_fee)
            .unwrap();
        pool.total_litter_distributed = pool
            .total_litter_distributed
            .checked_add(litter_out)
            .unwrap();

        // 8. Auto-Graduation Check
        if pool.accumulated_usdc >= config.graduation_threshold {
            emit!(GraduationReady {
                accumulated: pool.accumulated_usdc,
                threshold: config.graduation_threshold,
            });
            // In full implementation, this would trigger graduate_to_real internally
        }

        emit!(TokenDeposited {
            user: ctx.accounts.user.key(),
            amount_in: amount_in,
            litter_out: litter_out,
            fee_amount: fee_amount,
        });

        Ok(())
    }

    /// Manual graduation trigger (admin only)
    pub fn graduate_to_real(ctx: Context<GraduateToReal>) -> Result<()> {
        let config = &mut ctx.accounts.config;
        let pool = &mut ctx.accounts.virtual_pool;

        require!(
            pool.accumulated_usdc >= config.graduation_threshold,
            LitterError::ThresholdNotMet
        );
        require!(
            config.pool_mode == PoolMode::Virtual as u8,
            LitterError::AlreadyGraduated
        );

        // In Phase 2: Create Raydium pool via CPI
        // - Take accumulated USDC
        // - Take matching $LITTER from vault
        // - Initialize Raydium pool
        // - Store pool address

        config.pool_mode = PoolMode::Real as u8;
        // config.real_pool_address = new_pool_key;

        emit!(ProtocolGraduated {
            pool_mode: config.pool_mode,
        });

        Ok(())
    }
}

// --- State Accounts ---

#[account]
pub struct Config {
    pub authority: Pubkey,
    pub litter_mint: Pubkey,
    pub usdc_mint: Pubkey,
    pub vault: Pubkey,
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

// --- Contexts ---

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = authority, space = 8 + Config::SIZE)]
    pub config: Account<'info, Config>,
    
    #[account(init, payer = authority, space = 8 + VirtualPool::SIZE)]
    pub virtual_pool: Account<'info, VirtualPool>,
    
    #[account(
        init,
        payer = authority,
        associated_token::mint = litter_mint,
        associated_token::authority = config
    )]
    pub vault: Account<'info, TokenAccount>,
    
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
    pub config: Account<'info, Config>,
    
    #[account(mut)]
    pub virtual_pool: Account<'info, VirtualPool>,
    
    #[account(mut)]
    pub litter_vault: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub user_vault: Account<'info, TokenAccount>, // The token user is depositing
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
    // Jupiter accounts will be added in Phase 2
}

#[derive(Accounts)]
pub struct GraduateToReal<'info> {
    #[account(mut)]
    pub config: Account<'info, Config>,
    
    #[account(mut)]
    pub virtual_pool: Account<'info, VirtualPool>,
    
    pub authority: Signer<'info>,
}

// --- Error Codes ---

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
    #[msg("Unauthorized")]
    Unauthorized,
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
}

// --- Constants & Helpers ---

pub enum PoolMode {
    Virtual = 0,
    Real = 1,
}

impl Config {
    pub const SIZE: usize = 32 + 32 + 32 + 32 + 8 + 1 + 32 + 1;
}

impl VirtualPool {
    pub const SIZE: usize = 8 + 8 + 8 + 8 + 1;
}

// InitializeParams struct for clarity
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeParams {
    pub graduation_threshold: u64,
    pub virtual_initial_usdc: u64,
    pub virtual_initial_litter: u64,
}
