use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, Transfer};

declare_id!("dao11111111111111111111111111111111111111");

#[program]
pub mod dao_contract {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        fundraise_target: u64,
        min_pool_price: u64,
        expiry_timestamp: i64,
    ) -> Result<()> {
        let dao = &mut ctx.accounts.dao_state;
        require!(expiry_timestamp > Clock::get()?.unix_timestamp, DaoError::InvalidExpiry);
        require!(fundraise_target > 0, DaoError::InvalidAmount);
        require!(min_pool_price > 0, DaoError::InvalidPrice);

        dao.manager = ctx.accounts.manager.key();
        dao.dao_token = ctx.accounts.dao_token.key();
        dao.fundraise_target = fundraise_target;
        dao.min_pool_price = min_pool_price;
        dao.expiry_timestamp = expiry_timestamp;
        dao.trading_active = false;
        dao.total_staked = 0;
        dao.version = 1; // initialize version to 1
        Ok(())
    }

    pub fn create_pool(ctx: Context<CreatePool>, sol_amount: u64, token_amount: u64) -> Result<()> {
        let dao = &mut ctx.accounts.dao_state;
        require!(!dao.trading_active, DaoError::PoolAlreadyActive);
        require!(sol_amount > 0 && token_amount > 0, DaoError::InvalidAmount);
        // (Token transfers omitted for brevity.)
        dao.trading_active = true;
        Ok(())
    }

    pub fn stake_lp(ctx: Context<StakeLP>, amount: u64) -> Result<()> {
        require!(amount > 0, DaoError::InvalidAmount);
        let staking = &mut ctx.accounts.staking_account;
        staking.amount = staking.amount.checked_add(amount).unwrap();
        Ok(())
    }

    pub fn unstake_lp(ctx: Context<UnstakeLP>, amount: u64) -> Result<()> {
        let staking = &mut ctx.accounts.staking_account;
        require!(staking.amount >= amount, DaoError::InsufficientStake);
        staking.amount = staking.amount.checked_sub(amount).unwrap();
        Ok(())
    }
    
    pub fn upgrade(ctx: Context<Upgrade>, new_version: u8) -> Result<()> {
        let dao = &mut ctx.accounts.dao_state;
        require!(ctx.accounts.manager.key() == dao.manager, DaoError::Unauthorized);
        dao.version = new_version;
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(fundraise_target: u64, min_pool_price: u64, expiry_timestamp: i64)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = manager,
        space = 8 + DAOState::SIZE,
        seeds = [b"dao", dao_token.key().as_ref()],
        bump,
    )]
    pub dao_state: Account<'info, DAOState>,
    #[account(mut)]
    pub manager: Signer<'info>,
    pub dao_token: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct CreatePool<'info> {
    #[account(mut, has_one = manager)]
    pub dao_state: Account<'info, DAOState>,
    #[account(mut)]
    pub manager: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct StakeLP<'info> {
    #[account(mut)]
    pub dao_state: Account<'info, DAOState>,
    #[account(init_if_needed, payer = user, space = 8 + StakingAccount::SIZE)]
    pub staking_account: Account<'info, StakingAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct UnstakeLP<'info> {
    #[account(mut)]
    pub dao_state: Account<'info, DAOState>,
    #[account(mut)]
    pub staking_account: Account<'info, StakingAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
}

#[derive(Accounts)]
pub struct Upgrade<'info> {
    #[account(mut, has_one = manager)]
    pub dao_state: Account<'info, DAOState>,
    #[account(mut)]
    pub manager: Signer<'info>,
}

#[account]
pub struct DAOState {
    pub manager: Pubkey,
    pub dao_token: Pubkey,
    pub fundraise_target: u64,
    pub min_pool_price: u64,
    pub expiry_timestamp: i64,
    pub total_staked: u64,
    pub trading_active: bool,
    pub version: u8, // New field for versioning
}

impl DAOState {
    pub const SIZE: usize = 32 + 32 + 8 + 8 + 8 + 8 + 1 + 1; // Added 1 byte for version
}

#[account]
pub struct StakingAccount {
    pub amount: u64,
}

impl StakingAccount {
    pub const SIZE: usize = 8;
}

#[error_code]
pub enum DaoError {
    #[msg("Invalid expiry timestamp")]
    InvalidExpiry,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Invalid price")]
    InvalidPrice,
    #[msg("Pool already active")]
    PoolAlreadyActive,
    #[msg("Insufficient stake")]
    InsufficientStake,
    #[msg("Unauthorized")]
    Unauthorized,
}
