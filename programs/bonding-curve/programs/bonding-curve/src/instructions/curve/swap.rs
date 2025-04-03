use anchor_lang::{ prelude::*, solana_program::{ self, system_instruction } };
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{ Mint, TokenAccount, TokenInterface, TransferChecked, transfer_checked },
};

use crate::{
    errors::ContractError,
    BondingCurve,
    BondingCurveLockerCtx,
    BuyResult,
    DAOProposal,
    Global,
    IntoBondingCurveLockerCtx,
    SellResult,
    TokensPurchased,
    TokensSold, // Event
};

#[derive(anchor_lang::AnchorSerialize, anchor_lang::AnchorDeserialize)]
pub struct SwapParams {
    pub base_in: bool,
    pub amount: u64,
    pub min_out_amount: u64,
}

#[derive(Accounts)]
pub struct Swap<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        seeds=[Global::SEED_PREFIX.as_bytes()],
        constraint=global.initialized == true @ ContractError::NotInitialized,
        bump = global.bump
    )]
    pub global: Box<Account<'info, Global>>,

    #[account(mut)]
    /// CHECK: fee reciever asserted in validation function
    pub fee_receiver: AccountInfo<'info>,

    mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        mut,
        seeds=[BondingCurve::SEED_PREFIX.as_bytes(), mint.to_account_info().key.as_ref()],
        constraint = bonding_curve.mint == *mint.to_account_info().key @ ContractError::NotBondingCurveMint,
        constraint = bonding_curve.complete == false @ ContractError::BondingCurveComplete,
        bump = bonding_curve.bump
    )]
    pub bonding_curve: Box<Account<'info, BondingCurve>>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority= bonding_curve,
        constraint = bonding_curve.mint == *mint.to_account_info().key @ ContractError::NotBondingCurveMint,
    )]
    pub bonding_curve_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = mint,
        associated_token::authority = user
    )]
    pub user_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    // Add DAO proposal access when needed
    #[account(
        seeds = [DAOProposal::SEED_PREFIX.as_bytes(), mint.to_account_info().key.as_ref()],
        bump
    )]
    pub dao_proposal: Box<Account<'info, DAOProposal>>,

    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub clock: Sysvar<'info, Clock>,
}

impl<'info> IntoBondingCurveLockerCtx<'info> for Swap<'info> {
    fn into_bonding_curve_locker_ctx(
        &self,
        bonding_curve_bump: u8
    ) -> BondingCurveLockerCtx<'info> {
        BondingCurveLockerCtx {
            bonding_curve_bump,
            mint: self.mint.clone(),
            global: self.global.clone(),
            bonding_curve: self.bonding_curve.clone(),
            bonding_curve_token_account: self.bonding_curve_token_account.clone(),
            token_program: self.token_program.clone(),
        }
    }
}

impl<'info> Swap<'info> {
    pub fn validate(&self, params: &SwapParams) -> Result<()> {
        let SwapParams { base_in, amount, min_out_amount: _ } = params;
        let clock = Clock::get()?;
        require!(self.bonding_curve.is_started(&clock), ContractError::CurveNotStarted);
        require!(*amount > 0, ContractError::MinSwap);
        require!(
            self.fee_receiver.key() == self.global.fee_receiver.key(),
            ContractError::InvalidFeeReceiver
        );
        if !*base_in && self.bonding_curve.sol_raise_target > 0 {
            if self.bonding_curve.sol_raise_target >= self.bonding_curve.sol_raise_target {
                // will decide what's the best way to handle this
                msg!("Target SOL reached. Maybe migrate now!?");
            }

            if self.bonding_curve.real_sol_reserves + *amount > self.bonding_curve.sol_raise_target {
                msg!("Target SOL will be reached congrats!");
            }
        }
        Ok(())
    }
    pub fn process(&mut self, params: SwapParams) -> Result<()> {
        let SwapParams { base_in, amount, min_out_amount } = params;
        msg!(
            "Swap started. BaseIn: {}, AmountIn: {}, MinOutAmount: {}",
            base_in,
            amount,
            min_out_amount
        );

        let bonding_curve = self.bonding_curve.clone();
        let locker = self.into_bonding_curve_locker_ctx(self.bonding_curve.bump);
        locker.unlock_ata()?;

        let sol_amount: u64;
        let token_amount: u64;
        let fee_lamports: u64;
        let clock = Clock::get()?;

        if base_in {
            // Sell token for SOL
            require!(
                self.user_token_account.amount >= amount,
                ContractError::InsufficientUserTokens
            );

            // Add check to verify bonding curve has enough SOL
            let bonding_curve_sol = self.bonding_curve.real_sol_reserves;
            msg!("Bonding curve SOL reserves: {}", bonding_curve_sol);

            let sell_result = match self.bonding_curve.apply_sell(amount) {
                Some(result) => result,
                None => {
                    msg!("Sell failed - likely insufficient SOL in bonding curve");
                    return Err(ContractError::SellFailed.into());
                }
            };

            msg!("SellResult: {:#?}", sell_result);

            sol_amount = sell_result.sol_amount;
            token_amount = sell_result.token_amount;

            fee_lamports = bonding_curve.calculate_fee(sol_amount, clock.unix_timestamp)?;
            msg!("Fee: {} SOL", fee_lamports);
            self.complete_sell(sell_result.clone(), min_out_amount, fee_lamports)?;

            // Emit event with the actual price
            emit!(TokensSold {
                bonding_curve: self.bonding_curve.key(),
                seller: self.user.key(),
                token_amount,
                sol_amount,
                price_per_token: sell_result.price_per_token,
                timestamp: clock.unix_timestamp,
            });
        } else {
            // Buy token with SOL
            let buy_result = self.bonding_curve.apply_buy(amount).ok_or(ContractError::BuyFailed)?;

            sol_amount = buy_result.sol_amount;
            token_amount = buy_result.token_amount;

            fee_lamports = bonding_curve.calculate_fee(sol_amount, clock.unix_timestamp)?;
            self.complete_buy(buy_result.clone(), min_out_amount, fee_lamports)?;

            // Emit simplified event to save compute units
            emit!(TokensPurchased {
                bonding_curve: self.bonding_curve.key(),
                buyer: self.user.key(),
                sol_amount,
                token_amount,
                price_per_token: buy_result.price_per_token,
                timestamp: clock.unix_timestamp,
            });
        }

        // Optimize invariant check for production
        BondingCurve::invariant(&mut self.into_bonding_curve_locker_ctx(self.bonding_curve.bump))?;
        msg!("{:#?}", bonding_curve);

        Ok(())
    }

    fn complete_buy(
        &self,
        buy_result: BuyResult,
        min_out_amount: u64,
        fee_lamports: u64
    ) -> Result<()> {
        let buy_token_with_fee = buy_result.token_amount + fee_lamports;
        require!(buy_result.token_amount >= min_out_amount, ContractError::SlippageExceeded);
        require!(
            self.user.get_lamports() >= buy_token_with_fee,
            ContractError::InsufficientUserSOL
        );
        // Transfer tokens to user
        let cpi_accounts = TransferChecked {
            from: self.bonding_curve_token_account.to_account_info(),
            authority: self.bonding_curve.to_account_info(),
            to: self.user_token_account.to_account_info(),
            mint: self.mint.to_account_info(),
        };
        let signer = BondingCurve::get_signer(&self.bonding_curve.bump, &self.bonding_curve.mint);
        let signer_seeds = &[&signer[..]];
        transfer_checked(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                cpi_accounts,
                signer_seeds
            ),
            buy_result.token_amount,
            self.mint.decimals
        )?;
        let locker = &mut self.into_bonding_curve_locker_ctx(self.bonding_curve.bump);
        locker.lock_ata()?;
        msg!("Token transfer complete");

        // Transfer entire SOL amount to bonding curve (no split during active phase)
        let transfer_instruction = system_instruction::transfer(
            self.user.key,
            &self.bonding_curve.key(),
            buy_result.sol_amount
        );
        solana_program::program::invoke_signed(
            &transfer_instruction,
            &[
                self.user.to_account_info(),
                self.bonding_curve.to_account_info(),
                self.system_program.to_account_info(),
            ],
            &[]
        )?;
        msg!("SOL transfer complete");

        // Transfer fee to fee receiver
        let fee_transfer_ix = system_instruction::transfer(
            self.user.key,
            &self.fee_receiver.key(),
            fee_lamports
        );
        solana_program::program::invoke_signed(
            &fee_transfer_ix,
            &[
                self.user.to_account_info(),
                self.fee_receiver.clone(),
                self.system_program.to_account_info(),
            ],
            &[]
        )?;
        msg!("Fee transfer complete");
        Ok(())
    }

    fn complete_sell(
        &self,
        sell_result: SellResult,
        min_out_amount: u64,
        fee_lamports: u64
    ) -> Result<()> {
        // Sell tokens
        let sell_amount_minus_fee = sell_result.sol_amount - fee_lamports;
        require!(sell_amount_minus_fee >= min_out_amount, ContractError::SlippageExceeded);
        let cpi_accounts = TransferChecked {
            from: self.user_token_account.to_account_info(),
            authority: self.user.to_account_info(),
            to: self.bonding_curve_token_account.to_account_info(),
            mint: self.mint.to_account_info(),
        };
        transfer_checked(
            CpiContext::new(self.token_program.to_account_info(), cpi_accounts),
            sell_result.token_amount,
            self.mint.decimals
        )?;
        let locker = &mut self.into_bonding_curve_locker_ctx(self.bonding_curve.bump);
        locker.lock_ata()?;
        msg!("Token transfer complete");

        // Transfer SOL to user
        self.bonding_curve.sub_lamports(sell_amount_minus_fee).unwrap();
        self.user.add_lamports(sell_amount_minus_fee).unwrap();
        msg!("SOL transfer complete");

        self.bonding_curve.sub_lamports(fee_lamports).unwrap();
        self.fee_receiver.add_lamports(fee_lamports).unwrap();
        msg!("Fee transfer complete");
        Ok(())
    }
}
