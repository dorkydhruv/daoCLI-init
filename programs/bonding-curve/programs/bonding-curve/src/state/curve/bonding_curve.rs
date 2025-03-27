use std::fmt;

use anchor_lang::prelude::*;

use crate::{ errors::ContractError, Global };

use super::BondingCurveLockerCtx;

#[account]
#[derive(InitSpace, Debug, Default)]
pub struct BondingCurve {
    pub mint: Pubkey,
    pub creator: Pubkey,
    pub initial_virtual_token_reserves: u64,
    pub virtual_sol_reserves: u64,
    pub virtual_token_reserves: u64,
    pub real_sol_reserves: u64,
    pub real_token_reserves: u64,
    pub token_total_supply: u64,
    pub start_time: i64,
    pub complete: bool,
    pub bump: u8,
    pub sol_raise_target: u64,
    pub realm_pubkey: Pubkey,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CreateBondingCurveParams {
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub start_time: Option<i64>,
    pub sol_raise_target: u64,
    pub realm_pubkey: Pubkey,
}

#[derive(Debug, Clone)]
pub struct BuyResult {
    /// Amount of tokens that the user will receive
    pub token_amount: u64,
    /// Amount of SOL that the user paid
    pub sol_amount: u64,
}

#[derive(Debug, Clone)]
pub struct SellResult {
    /// Amount of tokens that the user is selling
    pub token_amount: u64,
    /// Amount of SOL that the user will receive
    pub sol_amount: u64,
}

impl BondingCurve {
    pub const SEED_PREFIX: &'static str = "bonding-curve";

    pub fn get_signer<'a>(bump: &'a u8, mint: &'a Pubkey) -> [&'a [u8]; 3] {
        [Self::SEED_PREFIX.as_bytes(), mint.as_ref(), std::slice::from_ref(bump)]
    }

    pub fn is_started(&self, clock: &Clock) -> bool {
        let now = clock.unix_timestamp;
        now >= self.start_time
    }

    pub fn msg(&self) -> () {
        msg!("{:#?}", self);
    }

    pub fn update_from_params(
        &mut self,
        mint: Pubkey,
        creator: Pubkey,
        global_config: &Global,
        params: &CreateBondingCurveParams,
        clock: &Clock,
        bump: u8
    ) -> &mut Self {
        let start_time = if let Some(start_time) = params.start_time {
            start_time
        } else {
            clock.unix_timestamp
        };
        let creator = creator;
        let complete = false;

        let sol_raise_target = params.sol_raise_target;

        let realm_pubkey = params.realm_pubkey;

        self.clone_from(
            &(BondingCurve {
                mint,
                creator,
                virtual_token_reserves: global_config.initial_virtual_token_reserves,
                virtual_sol_reserves: global_config.initial_virtual_sol_reserves,
                initial_virtual_token_reserves: global_config.initial_virtual_token_reserves,
                real_sol_reserves: 0,
                real_token_reserves: global_config.initial_real_token_reserves,
                token_total_supply: global_config.token_total_supply,
                start_time,
                complete,
                bump,
                sol_raise_target,
                realm_pubkey,
            })
        );
        self
    }

    pub fn invariant(ctx: &mut BondingCurveLockerCtx) -> Result<()> {
        let bonding_curve = &mut ctx.bonding_curve;
        let tkn_account = &mut ctx.bonding_curve_token_account;
        if tkn_account.to_account_info().owner != &bonding_curve.key() {
            msg!("Token account owner is not the bonding curve");
            return Err(ContractError::BondingCurveInvariant.into());
        }
        tkn_account.reload()?;
        let lamports = bonding_curve.get_lamports();
        let mut tkn_amount = tkn_account.amount;
        if tkn_amount + ctx.global.initial_real_token_reserves >= ctx.global.token_total_supply {
            tkn_amount = tkn_amount
                .checked_add(ctx.global.initial_real_token_reserves)
                .ok_or(ContractError::ArithmeticError)?
                .checked_sub(ctx.global.token_total_supply)
                .ok_or(ContractError::ArithmeticError)?;
        }
        let rent_exemption_balance: u64 = Rent::get()?.minimum_balance(
            8 + (BondingCurve::INIT_SPACE as usize)
        );
        let bonding_curve_pool_lamports: u64 = lamports - rent_exemption_balance;
        // Ensure real sol reserves are equal to bonding curve pool lamports
        if bonding_curve_pool_lamports != bonding_curve.real_sol_reserves {
            msg!(
                "real_sol_r:{}, bonding_lamps:{}",
                bonding_curve.real_sol_reserves,
                bonding_curve_pool_lamports
            );
            msg!("Invariant failed: real_sol_reserves != bonding_curve_pool_lamports");
            return Err(ContractError::BondingCurveInvariant.into());
        }

        // Ensure the virtual reserves are always positive
        if bonding_curve.virtual_sol_reserves <= 0 {
            msg!("Invariant failed: virtual_sol_reserves <= 0");
            return Err(ContractError::BondingCurveInvariant.into());
        }
        if bonding_curve.virtual_token_reserves <= 0 {
            msg!("Invariant failed: virtual_token_reserves <= 0");
            return Err(ContractError::BondingCurveInvariant.into());
        }

        // Ensure the token total supply is consistent with the reserves
        if bonding_curve.real_token_reserves != tkn_amount {
            msg!("Invariant failed: real_token_reserves != tkn_amount");
            msg!("real_token_reserves: {}", bonding_curve.real_token_reserves);
            msg!("real_token_reserves: {}", bonding_curve.token_total_supply);
            msg!("tkn_amount: {}", tkn_amount);
            return Err(ContractError::BondingCurveInvariant.into());
        }

        // Ensure the bonding curve is complete only if real token reserves are zero
        // get back to this later
        // if bonding_curve.complete && bonding_curve.real_token_reserves != 0 {
        //     msg!("Invariant failed: bonding curve marked as complete but real_token_reserves != 0");
        //     return Err(ContractError::BondingCurveInvariant.into());
        // }

        // if !bonding_curve.complete && !tkn_account.is_frozen() {
        //     msg!("Active BondingCurve TokenAccount must always be frozen at the end");
        //     return Err(ContractError::BondingCurveInvariant.into());
        // }
        Ok(())
    }
}

impl fmt::Display for BondingCurve {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(
            f,
            "BondingCurve {{ creator: {:?}, initial_virtual_token_reserves: {:?}, virtual_sol_reserves: {:?}, virtual_token_reserves: {:?}, real_sol_reserves: {:?}, real_token_reserves: {:?}, token_total_supply: {:?}, start_time: {:?}, complete: {:?} }}",
            self.creator,
            self.initial_virtual_token_reserves,
            self.virtual_sol_reserves,
            self.virtual_token_reserves,
            self.real_sol_reserves,
            self.real_token_reserves,
            self.token_total_supply,
            self.start_time,
            self.complete
        )
    }
}
