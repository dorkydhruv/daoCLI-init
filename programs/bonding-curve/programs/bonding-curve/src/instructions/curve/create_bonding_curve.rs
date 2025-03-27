use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    metadata::{
        create_metadata_accounts_v3,
        mpl_token_metadata::types::DataV2,
        CreateMetadataAccountsV3,
        Metadata,
    },
    token_interface::{ Mint, TokenAccount, TokenInterface, mint_to, MintTo },
};

use crate::{
    errors::ContractError,
    BondingCurve,
    BondingCurveLockerCtx,
    CreateBondingCurveParams,
    Global,
    IntoBondingCurveLockerCtx,
    ProgramStatus,
};

#[derive(Accounts)]
pub struct CreateBondingCurve<'info> {
    #[account(
        init,
        payer = creator,
        mint::decimals = global.mint_decimals,
        mint::authority = bonding_curve,
        mint::freeze_authority = bonding_curve
    )]
    pub mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(mut)]
    pub creator: Signer<'info>,
    #[account(
        init,
        payer = creator,
        seeds = [b"bonding_curve", mint.to_account_info().key.as_ref()],
        bump,
        space = 8 + BondingCurve::INIT_SPACE
    )]
    pub bonding_curve: Box<Account<'info, BondingCurve>>,
    #[account(
        init_if_needed,
        payer = creator,
        associated_token::mint = mint,
        associated_token::authority = bonding_curve
    )]
    bonding_curve_token_account: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        seeds = [Global::SEED_PREFIX.as_bytes()],
        constraint = global.initialized == true @ ContractError::NotInitialized,
        constraint = global.status == ProgramStatus::Running @ ContractError::ProgramNotRunning,
        bump,
    )]
    global: Box<Account<'info, Global>>,
    #[account(mut)]
    ///CHECK: Using seed to validate metadata account
    metadata: UncheckedAccount<'info>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
    pub token_metadata_program: Program<'info, Metadata>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl<'info> IntoBondingCurveLockerCtx<'info> for CreateBondingCurve<'info> {
    fn into_bonding_curve_locker_ctx(
        &self,
        bonding_curve_bump: u8
    ) -> BondingCurveLockerCtx<'info> {
        BondingCurveLockerCtx {
            bonding_curve_bump,
            mint: self.mint.clone(),
            bonding_curve: self.bonding_curve.clone(),
            bonding_curve_token_account: self.bonding_curve_token_account.clone(),
            token_program: self.token_program.clone(),
            global: self.global.clone(),
        }
    }
}

impl<'info> CreateBondingCurve<'info> {
    pub fn validate(&self, params: &CreateBondingCurveParams) -> Result<()> {
        let clock = Clock::get()?;
        if let Some(start_time) = params.start_time {
            require!(start_time <= clock.unix_timestamp, ContractError::InvalidStartTime);
        }
        // add more validations here
        Ok(())
    }

    pub fn process(
        &mut self,
        params: CreateBondingCurveParams,
        bumps: &CreateBondingCurveBumps
    ) -> Result<()> {
        let clock = Clock::get()?;
        self.bonding_curve.update_from_params(
            self.mint.key(),
            *self.creator.key,
            &self.global,
            &params,
            &clock,
            bumps.bonding_curve
        );
        self.validate(&params)?;
        let mint_k = self.mint.key();
        let mint_authority_signer = BondingCurve::get_signer(&bumps.bonding_curve, &mint_k);
        let mint_auth_signer_seeds = &[&mint_authority_signer[..]];
        let mint_authority_info = self.bonding_curve.to_account_info();
        let mint_info = self.mint.to_account_info();
        self.initialize_meta(mint_auth_signer_seeds, &params)?;
        msg!("Initialize meta complete");
        mint_to(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                MintTo {
                    authority: mint_authority_info.clone(),
                    to: self.bonding_curve_token_account.to_account_info(),
                    mint: mint_info.clone(),
                },
                mint_auth_signer_seeds
            ),
            self.bonding_curve.token_total_supply
        )?;
        msg!("Mint to complete");
        let locker = &mut self.into_bonding_curve_locker_ctx(bumps.bonding_curve);
        locker.revoke_mint_authority()?;
        msg!("Revoke mint authority complete");
        locker.lock_ata()?;
        msg!("Lock ATA complete");
        msg!("Checking invariant");
        BondingCurve::invariant(locker)?;
        msg!("CreateBondingCurve::process: done");
        Ok(())
    }

    fn initialize_meta(
        &mut self,
        mint_auth_signer_seeds: &[&[&[u8]]; 1],
        params: &CreateBondingCurveParams
    ) -> Result<()> {
        let mint_info = self.mint.to_account_info();
        let mint_authority_info = self.bonding_curve.to_account_info();
        let metadata_info = self.metadata.to_account_info();
        let token_data: DataV2 = DataV2 {
            name: params.name.clone(),
            symbol: params.symbol.clone(),
            uri: params.uri.clone(),
            seller_fee_basis_points: 0,
            creators: None,
            collection: None,
            uses: None,
        };
        let metadata_ctx = CpiContext::new_with_signer(
            self.token_metadata_program.to_account_info(),
            CreateMetadataAccountsV3 {
                payer: self.creator.to_account_info(),
                mint: mint_info.clone(),
                metadata: metadata_info.clone(),
                update_authority: mint_authority_info.clone(),
                mint_authority: mint_authority_info.clone(),
                system_program: self.system_program.to_account_info(),
                rent: self.rent.to_account_info(),
            },
            mint_auth_signer_seeds
        );
        create_metadata_accounts_v3(metadata_ctx, token_data, false, true, None)?;
        msg!("CreateBondingCurve::intialize_meta: done");
        Ok(())
    }
}
