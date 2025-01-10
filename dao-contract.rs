use anchor_lang::prelude::*;
use anchor_spl::{
    token::{self, Token, TokenAccount, Mint, Transfer},
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
        require!(expiry_timestamp > Clock::get()?.unix_timestamp, DaoError::InvalidExpiry);
        require!(fundraise_target > 0, DaoError::InvalidAmount);
        require!(min_pool_price > 0, DaoError::InvalidPrice);

        let dao = &mut ctx.accounts.dao_state;
        dao.manager = ctx.accounts.manager.key();
        dao.dao_token = ctx.accounts.dao_token.key();
        dao.fundraise_target = fundraise_target;
        dao.min_pool_price = min_pool_price;
        dao.expiry_timestamp = expiry_timestamp;
        dao.bump = *ctx.bumps.get("dao_state").unwrap();
        dao.treasury_bump = *ctx.bumps.get("treasury").unwrap();
        
        emit!(DAOInitialized {
            manager: dao.manager,
            dao_token: dao.dao_token,
            fundraise_target,
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        Ok(())
    }

    pub fn create_pool(
        ctx: Context<CreatePool>,
        sol_amount: u64,
        token_amount: u64,
    ) -> Result<()> {
        let dao = &mut ctx.accounts.dao_state;
        require!(!dao.trading_active, DaoError::PoolAlreadyActive);
        require!(sol_amount > 0 && token_amount > 0, DaoError::InvalidAmount);

        // Transfer SOL to pool
        let transfer_sol = Transfer {
            from: ctx.accounts.manager_sol.to_account_info(),
            to: ctx.accounts.pool_sol.to_account_info(),
            authority: ctx.accounts.manager.to_account_info(),
        };
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                transfer_sol,
            ),
            sol_amount,
        )?;

        // Transfer tokens to pool
        let transfer_token = Transfer {
            from: ctx.accounts.manager_token.to_account_info(),
            to: ctx.accounts.pool_token.to_account_info(),
            authority: ctx.accounts.manager.to_account_info(),
        };
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                transfer_token,
            ),
            token_amount,
        )?;

        dao.pool_sol = ctx.accounts.pool_sol.key();
        dao.pool_token = ctx.accounts.pool_token.key();
        dao.lp_mint = ctx.accounts.lp_mint.key();
        dao.trading_active = true;

        emit!(PoolCreated {
            pool_sol: dao.pool_sol,
            pool_token: dao.pool_token,
            lp_mint: dao.lp_mint,
            sol_amount,
            token_amount,
        });

        Ok(())
    }

    pub fn stake_lp(
        ctx: Context<StakeLP>,
        amount: u64,
    ) -> Result<()> {
        require!(amount > 0, DaoError::InvalidAmount);
        let dao = &mut ctx.accounts.dao_state;
        require!(dao.trading_active, DaoError::PoolNotActive);

        let staking = &mut ctx.accounts.staking_account;
        let seeds = [
            b"dao",
            dao.dao_token.as_ref(),
            &[dao.bump]
        ];

        // Transfer LP tokens
        let transfer_lp = Transfer {
            from: ctx.accounts.user_lp.to_account_info(),
            to: ctx.accounts.pool_lp.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                transfer_lp,
            ),
            amount,
        )?;

        // Update staking info
        staking.amount = staking.amount.checked_add(amount).unwrap();
        dao.total_staked = dao.total_staked.checked_add(amount).unwrap();
        
        emit!(Staked {
            user: ctx.accounts.user.key(),
            amount,
        });

        Ok(())
    }

    pub fn unstake_lp(
        ctx: Context<UnstakeLP>,
        amount: u64,
    ) -> Result<()> {
        require!(amount > 0, DaoError::InvalidAmount);
        let dao = &mut ctx.accounts.dao_state;
        let staking = &mut ctx.accounts.staking_account;
        require!(staking.amount >= amount, DaoError::InsufficientStake);

        let seeds = [
            b"dao",
            dao.dao_token.as_ref(),
            &[dao.bump]
        ];
        let signer = &[&seeds[..]];

        // Transfer LP tokens back
        let transfer_lp = Transfer {
            from: ctx.accounts.pool_lp.to_account_info(),
            to: ctx.accounts.user_lp.to_account_info(),
            authority: ctx.accounts.dao_state.to_account_info(),
        };
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                transfer_lp,
                signer
            ),
            amount,
        )?;

        // Update staking info
        staking.amount = staking.amount.checked_sub(amount).unwrap();
        dao.total_staked = dao.total_staked.checked_sub(amount).unwrap();

        emit!(Unstaked {
            user: ctx.accounts.user.key(),
            amount,
        });

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

    #[account(
        seeds = [b"treasury", dao_state.key().as_ref()],
        bump,
    )]
    /// CHECK: PDA owned by program
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
    #[account(
        mut,
        seeds = [b"dao", dao_state.dao_token.as_ref()],
        bump = dao_state.bump,
        has_one = manager,
    )]
    pub dao_state: Account<'info, DAOState>,
    
    #[account(mut)]
    pub manager: Signer<'info>,
    #[account(mut)]
    pub manager_sol: Account<'info, TokenAccount>,
    #[account(mut)]
    pub manager_token: Account<'info, TokenAccount>,
    #[account(mut)]
    pub pool_sol: Account<'info, TokenAccount>,
    #[account(mut)]
    pub pool_token: Account<'info, TokenAccount>,
    pub lp_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct StakeLP<'info> {
    #[account(
        mut,
        seeds = [b"dao", dao_state.dao_token.as_ref()],
        bump = dao_state.bump,
    )]
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
    #[account(
        mut,
        seeds = [b"dao", dao_state.dao_token.as_ref()],
        bump = dao_state.bump,
    )]
    pub dao_state: Account<'info, DAOState>,

    #[account(
        mut,
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
}

#[account]
pub struct DAOState {
    pub manager: Pubkey,
    pub dao_token: Pubkey,
    pub pool_sol: Pubkey,
    pub pool_token: Pubkey,
    pub lp_mint: Pubkey,
    pub fundraise_target: u64,
    pub min_pool_price: u64,
    pub expiry_timestamp: i64,
    pub total_staked: u64,
    pub bump: u8,
    pub treasury_bump: u8,
    pub trading_active: bool,
}

#[account]
pub struct StakingAccount {
    pub amount: u64,
}

impl DAOState {
    pub const SIZE: usize = 32 + 32 + 32 + 32 + 32 + 8 + 8 + 8 + 8 + 1 + 1 + 1;
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
    #[msg("Pool not active")]
    PoolNotActive,
    #[msg("Insufficient stake")]
    InsufficientStake,
}

#[event]
pub struct DAOInitialized {
    pub manager: Pubkey,
    pub dao_token: Pubkey,
    pub fundraise_target: u64,
    pub timestamp: i64,
}

#[event]
pub struct PoolCreated {
    pub pool_sol: Pubkey,
    pub pool_token: Pubkey,
    pub lp_mint: Pubkey,
    pub sol_amount: u64,
    pub token_amount: u64,
}

#[event]
pub struct Staked {
    pub user: Pubkey,
    pub amount: u64,
}

#[event]
pub struct Unstaked {
    pub user: Pubkey,
    pub amount: u64,
}
