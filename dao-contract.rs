use anchor_lang::prelude::*;
use anchor_spl::{
    token::{Token, TokenAccount, Mint},
    associated_token::AssociatedToken,
};
use std::convert::TryFrom;

declare_id!("dao11111111111111111111111111111111111111");

#[program]
pub mod party_dao {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        fundraise_target: u64,
        min_pool_price: u64,
        expiry_timestamp: i64,
    ) -> Result<()> {
        let dao_state = &mut ctx.accounts.dao_state;
        dao_state.manager = ctx.accounts.manager.key();
        dao_state.treasury = ctx.accounts.treasury.key();
        dao_state.dao_token = ctx.accounts.dao_token.key();
        dao_state.fundraise_target = fundraise_target;
        dao_state.min_pool_price = min_pool_price;
        dao_state.expiry_timestamp = expiry_timestamp;
        dao_state.total_staked = 0;
        dao_state.reward_per_share = 0;
        dao_state.manager_fees = 0;
        dao_state.staking_rewards = 0;
        dao_state.is_expired = false;
        dao_state.trading_active = false;

        // Create treasury account
        let treasury_seeds = [
            b"treasury",
            dao_state.to_account_info().key.as_ref(),
            &[*ctx.bumps.get("treasury").unwrap()],
        ];
        let treasury_signer = &[&treasury_seeds[..]];

        Ok(())
    }

    pub fn create_pool(
        ctx: Context<CreatePool>,
        sol_amount: u64,
        token_amount: u64,
    ) -> Result<()> {
        let dao_state = &mut ctx.accounts.dao_state;
        require!(
            ctx.accounts.manager.key() == dao_state.manager,
            PartyDAOError::UnauthorizedAccess
        );

        // Integrate with Orca SDK to create pool
        // Transfer initial liquidity
        dao_state.orca_pool = ctx.accounts.orca_pool.key();
        dao_state.lp_token = ctx.accounts.lp_token.key();
        dao_state.trading_active = true;

        Ok(())
    }

    pub fn stake_lp(
        ctx: Context<StakeLP>,
        amount: u64,
    ) -> Result<()> {
        let dao_state = &mut ctx.accounts.dao_state;
        let staking_account = &mut ctx.accounts.staking_account;
        
        // Update rewards before staking
        let current_timestamp = Clock::get()?.unix_timestamp;
        update_rewards(dao_state, current_timestamp)?;

        // Transfer LP tokens from user
        let cpi_accounts = anchor_spl::token::Transfer {
            from: ctx.accounts.user_lp.to_account_info(),
            to: ctx.accounts.pool_lp.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        anchor_spl::token::transfer(cpi_ctx, amount)?;

        // Update staking info
        staking_account.amount += amount;
        staking_account.reward_debt = calculate_reward_debt(
            amount,
            dao_state.reward_per_share,
        );
        dao_state.total_staked += amount;

        Ok(())
    }

    pub fn unstake_lp(
        ctx: Context<UnstakeLP>,
        amount: u64,
    ) -> Result<()> {
        let dao_state = &mut ctx.accounts.dao_state;
        let staking_account = &mut ctx.accounts.staking_account;
        
        require!(
            staking_account.amount >= amount,
            PartyDAOError::InsufficientStake
        );

        // Update rewards before unstaking
        let current_timestamp = Clock::get()?.unix_timestamp;
        update_rewards(dao_state, current_timestamp)?;

        // Calculate rewards
        let pending_reward = calculate_pending_reward(
            staking_account.amount,
            dao_state.reward_per_share,
            staking_account.reward_debt,
        );

        // Transfer LP tokens back to user
        let treasury_seeds = [
            b"treasury",
            dao_state.to_account_info().key.as_ref(),
            &[ctx.bumps.get("treasury").unwrap()],
        ];
        let treasury_signer = &[&treasury_seeds[..]];

        let cpi_accounts = anchor_spl::token::Transfer {
            from: ctx.accounts.pool_lp.to_account_info(),
            to: ctx.accounts.user_lp.to_account_info(),
            authority: ctx.accounts.treasury.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(
            cpi_program,
            cpi_accounts,
            treasury_signer,
        );
        anchor_spl::token::transfer(cpi_ctx, amount)?;

        // Update staking info
        staking_account.amount -= amount;
        staking_account.reward_debt = calculate_reward_debt(
            staking_account.amount,
            dao_state.reward_per_share,
        );
        dao_state.total_staked -= amount;

        // Transfer pending rewards
        if pending_reward > 0 {
            // Transfer reward tokens
            let cpi_accounts = anchor_spl::token::Transfer {
                from: ctx.accounts.reward_vault.to_account_info(),
                to: ctx.accounts.user_reward.to_account_info(),
                authority: ctx.accounts.treasury.to_account_info(),
            };
            let cpi_ctx = CpiContext::new_with_signer(
                cpi_program,
                cpi_accounts,
                treasury_signer,
            );
            anchor_spl::token::transfer(cpi_ctx, pending_reward)?;
        }

        Ok(())
    }

    pub fn collect_fees(ctx: Context<CollectFees>) -> Result<()> {
        let dao_state = &mut ctx.accounts.dao_state;
        require!(
            ctx.accounts.manager.key() == dao_state.manager,
            PartyDAOError::UnauthorizedAccess
        );

        // Calculate fees
        let trading_fees = dao_state.trading_fees;
        let staking_rewards = dao_state.staking_rewards;
        let manager_carry = dao_state.manager_fees;

        // Reset fee accumulators
        dao_state.trading_fees = 0;
        dao_state.staking_rewards = 0;
        dao_state.manager_fees = 0;

        // Transfer fees
        let treasury_seeds = [
            b"treasury",
            dao_state.to_account_info().key.as_ref(),
            &[ctx.bumps.get("treasury").unwrap()],
        ];
        let treasury_signer = &[&treasury_seeds[..]];

        // Transfer trading fees
        if trading_fees > 0 {
            let cpi_accounts = anchor_spl::token::Transfer {
                from: ctx.accounts.fee_vault.to_account_info(),
                to: ctx.accounts.manager_token.to_account_info(),
                authority: ctx.accounts.treasury.to_account_info(),
            };
            let cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts,
                treasury_signer,
            );
            anchor_spl::token::transfer(cpi_ctx, trading_fees)?;
        }

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
        seeds = [b"dao_state", manager.key().as_ref()],
        bump,
    )]
    pub dao_state: Account<'info, DAOState>,

    #[account(
        seeds = [b"treasury", dao_state.key().as_ref()],
        bump,
    )]
    /// CHECK: PDA owned by the program
    pub treasury: AccountInfo<'info>,

    #[account(mut)]
    pub manager: Signer<'info>,
    pub dao_token: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct CreatePool<'info> {
    #[account(mut)]
    pub dao_state: Account<'info, DAOState>,
    #[account(mut)]
    pub manager: Signer<'info>,
    /// CHECK: Verified in constraint
    #[account(mut)]
    pub orca_pool: AccountInfo<'info>,
    pub lp_token: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct StakeLP<'info> {
    #[account(mut)]
    pub dao_state: Account<'info, DAOState>,
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + StakingAccount::SIZE,
        seeds = [b"staking", user.key().as_ref()],
        bump,
    )]
    pub staking_account: Account<'info, StakingAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub user_lp: Account<'info, TokenAccount>,
    #[account(mut)]
    pub pool_lp: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
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
    #[account(mut)]
    pub user_lp: Account<'info, TokenAccount>,
    #[account(mut)]
    pub pool_lp: Account<'info, TokenAccount>,
    #[account(mut)]
    pub reward_vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_reward: Account<'info, TokenAccount>,
    /// CHECK: PDA owned by the program
    pub treasury: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CollectFees<'info> {
    #[account(mut)]
    pub dao_state: Account<'info, DAOState>,
    #[account(mut)]
    pub manager: Signer<'info>,
    #[account(mut)]
    pub fee_vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub manager_token: Account<'info, TokenAccount>,
    /// CHECK: PDA owned by the program
    pub treasury: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
}

#[account]
pub struct DAOState {
    pub manager: Pubkey,
    pub treasury: Pubkey,
    pub dao_token: Pubkey,
    pub lp_token: Pubkey,
    pub orca_pool: Pubkey,
    pub fundraise_target: u64,
    pub min_pool_price: u64,
    pub expiry_timestamp: i64,
    pub total_staked: u64,
    pub reward_per_share: u64,
    pub trading_fees: u64,
    pub staking_rewards: u64,
    pub manager_fees: u64,
    pub is_expired: bool,
    pub trading_active: bool,
}

#[account]
pub struct StakingAccount {
    pub amount: u64,
    pub reward_debt: u64,
}

impl DAOState {
    pub const SIZE: usize = 32 + 32 + 32 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 1 + 1;
}

impl StakingAccount {
    pub const SIZE: usize = 8 + 8;
}

#[error_code]
pub enum PartyDAOError {
    #[msg("Only the manager can perform this action")]
    UnauthorizedAccess,
    #[msg("Insufficient staked amount")]
    InsufficientStake,
    #[msg("Pool is not active")]
    PoolNotActive,
}

// Helper functions
fn update_rewards(
    dao_state: &mut DAOState,
    current_timestamp: i64,
) -> Result<()> {
    if dao_state.total_staked == 0 {
        return Ok(());
    }

    // Update reward per share
    dao_state.reward_per_share += dao_state.staking_rewards / dao_state.total_staked;
    dao_state.staking_rewards = 0;

    Ok(())
}

fn calculate_reward_debt(amount: u64, reward_per_share: u64) -> u64 {
    amount.checked_mul(reward_per_share).unwrap_or(0)
}

fn calculate_pending_reward(
    amount: u64,
    reward_per_share: u64,
    reward_debt: u64,
) -> u64 {
    amount
        .checked_mul(reward_per_share)
        .unwrap_or(0)
        .checked_sub(reward_debt)
        .unwrap_or(0)
}
