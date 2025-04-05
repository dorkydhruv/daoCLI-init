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
    DAOProposal, // New import
};

#[derive(Accounts)]
#[instruction(params: CreateBondingCurveParams)]
pub struct CreateBondingCurve<'info> {
    #[account(
        init,
        payer = creator,
        mint::decimals = global.mint_decimals,
        mint::authority = dao_proposal, // Change authority to dao_proposal
        mint::freeze_authority = bonding_curve, // Keep freeze authority with bonding curve for now,
        seeds = [
            BondingCurve::TOKEN_PREFIX.as_bytes(),
            params.name.as_bytes(),
            creator.key().as_ref(),
        ],
        bump
    )]
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        init,
        payer = creator,
        seeds = [BondingCurve::SEED_PREFIX.as_bytes(), mint.to_account_info().key.as_ref()],
        bump,
        space = 8 + BondingCurve::INIT_SPACE
    )]
    pub bonding_curve: Box<Account<'info, BondingCurve>>,

    #[account(
        init,
        payer = creator,
        seeds = [DAOProposal::SEED_PREFIX.as_bytes(), mint.to_account_info().key.as_ref()],
        bump,
        space = 8 + DAOProposal::INIT_SPACE
    )]
    pub dao_proposal: Box<Account<'info, DAOProposal>>,

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
            require!(start_time >= clock.unix_timestamp, ContractError::InvalidStartTime);
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

        // First initialize the DAOProposal
        self.initialize_dao_proposal(&params, bumps.dao_proposal)?;

        // Then update the bonding curve
        self.bonding_curve.update_from_params(
            self.mint.key(),
            *self.creator.key,
            &self.global,
            &params,
            &clock,
            bumps.bonding_curve
        );

        self.validate(&params)?;

        // Initialize metadata and mint tokens
        self.initialize_meta(&params)?;
        msg!("Initialize meta complete");

        // Use dao_proposal as the mint authority
        let mint_authority_seeds = self.dao_proposal.get_signer_seeds();
        let mint_auth_signer_seeds: &[&[&[u8]]] = &[&mint_authority_seeds];

        mint_to(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                MintTo {
                    authority: self.dao_proposal.to_account_info(),
                    to: self.bonding_curve_token_account.to_account_info(),
                    mint: self.mint.to_account_info(),
                },
                mint_auth_signer_seeds
            ),
            self.bonding_curve.token_total_supply
        )?;
        msg!("Mint to complete");

        let locker = &mut self.into_bonding_curve_locker_ctx(bumps.bonding_curve);
        locker.lock_ata()?;
        msg!("Lock ATA complete");

        msg!("Checking invariant");
        BondingCurve::invariant(locker)?;

        msg!("CreateBondingCurve::process: done");
        Ok(())
    }

    // New method to initialize the DAO proposal
    fn initialize_dao_proposal(
        &mut self,
        params: &CreateBondingCurveParams,
        dao_proposal_bump: u8
    ) -> Result<()> {
        // Initialize DAO proposal with provided parameters
        self.dao_proposal.mint = self.mint.key();
        self.dao_proposal.creator = *self.creator.key;
        self.dao_proposal.name = params.dao_name.clone();
        self.dao_proposal.description = params.dao_description.clone();
        self.dao_proposal.realm_address = params.realm_address.clone();
        self.dao_proposal.twitter_handle = params.twitter_handle.clone();
        self.dao_proposal.discord_link = params.discord_link.clone();
        self.dao_proposal.website_url = params.website_url.clone();
        self.dao_proposal.logo_uri = params.logo_uri.clone();
        self.dao_proposal.founder_name = params.founder_name.clone();
        self.dao_proposal.founder_twitter = params.founder_twitter.clone();
        self.dao_proposal.bullish_thesis = params.bullish_thesis.clone();
        self.dao_proposal.bump = dao_proposal_bump;

        msg!("DAO Proposal initialized");
        Ok(())
    }

    fn initialize_meta(&mut self, params: &CreateBondingCurveParams) -> Result<()> {
        let mint_info = self.mint.to_account_info();
        let metadata_info = self.metadata.to_account_info();
        let mint_key = mint_info.key;
        // Use dao_proposal as the mint and update authority
        let mint_authority_info = self.dao_proposal.to_account_info();

        let dao_signer = [
            DAOProposal::SEED_PREFIX.as_bytes(),
            mint_key.as_ref(),
            &[self.dao_proposal.bump],
        ];
        let dao_auth_signer_seeds = &[&dao_signer[..]];

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
            dao_auth_signer_seeds
        );

        create_metadata_accounts_v3(metadata_ctx, token_data, false, true, None)?;
        msg!("CreateBondingCurve::intialize_meta: done");
        Ok(())
    }
}
