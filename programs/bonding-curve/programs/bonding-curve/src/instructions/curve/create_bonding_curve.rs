use anchor_lang::prelude::*;
use anchor_spl::{
    token_interface::{ Mint, TokenAccount },
    metadata::{
        create_metadata_accounts_v3,
        mpl_token_metadata::types::DataV2,
        CreateMetadataAccountsV3, 
        Metadata as Metaplex,
    },
};

use crate::{ BondingCurve, Global };

#[derive(Accounts)]
pub struct CreateBondingCurve<'info> {
    #[account(
        init,
        payer = creator,
        mint::decimals = global.decimals,
        mint::authority = bonding_curve,
        mint::freeze_authority = bonding_curve
    )]
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub creator: Signer<'info>,
    #[account(
        init,
        payer = creator,
        seeds = [b"bonding_curve".as_bytes(), mint.to_account_info().key.as_ref()],
        bump,
        space = 8 + BondingCurve::INIT_SPACE
    )]
    pub bonding_curve: Account<'info, BondingCurve>,
    #[account(
        init_if_needed,
        payer = creator,
        associated_token::mint = mint,
        associated_token::authority = bonding_curve
    )]
    bonding_curve_token_account: Account<'info, TokenAccount>,
    #[account(
        seeds = [Global::SEED_PREFIX.as_bytes()],
        constraint = global.initialized == true @ ContractError::NotInitialized,
        constraint = global.status == ProgramStatus::Running @ ContractError::ProgramNotRunning,
        bump,
    )]
    global: Box<Account<'info, Global>>,
}
