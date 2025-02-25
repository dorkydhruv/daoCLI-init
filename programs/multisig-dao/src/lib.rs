#![allow(unexpected_cfgs)]
use anchor_lang::prelude::*;
declare_id!("4RYGFX9e2hZZqWMXUCQTK45Hb7drhc7cUPhvgPtNkNDk");
mod instructions;
mod state;
mod error;
mod args;
use crate::instructions::*;
use crate::error::Errors;
#[program]
pub mod multisig_dao {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }

    pub fn create_dao(
        ctx: Context<CreateDao>,
        name: String
        // supply: u64,
        // min_vote_to_govern: u64,
        // quorum: u8,
        // vote_duration: u32
    ) -> Result<()> {
        // Validate inputs
        require!(!name.is_empty(), Errors::EmptyName);
        require!(name.len() <= 32, Errors::NameTooLong);
        // require!(supply > 0, Errors::InvalidSupply);
        // require!(min_vote_to_govern > 0, Errors::InvalidMinVoteWeight);
        // require!(quorum > 0 && quorum <= 100, Errors::InvalidQuorum);
        // require!(vote_duration > 0, Errors::InvalidVoteDuration);

        // Execute instruction
        ctx.accounts.create_realm(name)?;
        // ctx.accounts.create_governance(vote_duration, quorum, min_vote_to_govern)?;
        // ctx.accounts.create_native_treasury()?;
        // ctx.accounts.set_realm_authority()?;
        // mint_to(ctx.accounts.mint_dao_allocation(), supply)?;
        Ok(())
    }
}

// #[error_code]
// pub enum CustomError {
//     #[msg("Invalid threshold provided.")]
//     InvalidThreshold,
//     #[msg("Unauthorized: Not a member of the Squad.")]
//     Unauthorized,
//     #[msg("Vote count overflow.")]
//     Overflow,
//     #[msg("Proposal threshold not met.")]
//     ThresholdNotMet,
// }

#[derive(Accounts)]
pub struct Initialize {}

// /// DAO account to store configuration details.
// #[account]
// pub struct Dao {
//     pub governance_program_id: Pubkey,
//     pub realm: Pubkey,
//     pub squads_program_id: Pubkey,
//     pub squad: Pubkey,
//     pub threshold: u64,
//     pub members: Vec<Pubkey>,
// }

// /// Proposal account holding proposal details, vote count, and actions.
// #[account]
// pub struct Proposal {
//     pub details: String,
//     pub creator: Pubkey,
//     pub vote_count: u64,
//     pub actions: Vec<Vec<u8>>, // New field to store a list of action instructions.
// }

// #[derive(Accounts)]
// pub struct CreateDao<'info> {
//     #[account(init, payer = payer, space = 8 + 32 * 4 + 8 + 4 + 10 * 32)]
//     pub dao: Account<'info, Dao>,
//     /// CHECK: Reference to the SPL Governance program.
//     pub governance_program: UncheckedAccount<'info>,
//     /// CHECK: Reference to the Squads program.
//     pub squads_program: UncheckedAccount<'info>,
//     /// CHECK: Realm account (new or existing).
//     pub realm: UncheckedAccount<'info>,
//     /// Authority for the SPL Governance realm.
//     pub realm_authority: Signer<'info>,
//     /// CHECK: Squads multisig account.
//     pub squad: UncheckedAccount<'info>,
//     #[account(mut)]
//     pub payer: Signer<'info>,
//     pub system_program: Program<'info, System>,
// }

// #[derive(Accounts)]
// pub struct CreateProposal<'info> {
//     pub dao: Account<'info, Dao>,
//     #[account(init, payer = proposer, space = 8 + 32 + 4 + 200 + 8 + (4 + 10 * 50))]
//     pub proposal: Account<'info, Proposal>,
//     #[account(mut)]
//     pub proposer: Signer<'info>,
//     pub system_program: Program<'info, System>,
// }

// #[derive(Accounts)]
// pub struct CastVote<'info> {
//     pub dao: Account<'info, Dao>,
//     #[account(mut)]
//     pub proposal: Account<'info, Proposal>,
//     pub voter: Signer<'info>,
// }

// #[derive(Accounts)]
// pub struct ExecuteProposal<'info> {
//     pub dao: Account<'info, Dao>,
//     #[account(mut)]
//     pub proposal: Account<'info, Proposal>,
//     // Additional accounts required for multisig execution (e.g., multisig authority) can be added.
// }

// // CPI account context for SPL Governance realm creation.
// #[derive(Accounts)]
// pub struct CreateRealmCpi<'info> {
//     /// CHECK: Realm account.
//     pub realm: AccountInfo<'info>,
//     /// CHECK: Realm authority.
//     pub realm_authority: AccountInfo<'info>,
//     /// CHECK: Payer.
//     pub payer: AccountInfo<'info>,
//     pub system_program: AccountInfo<'info>,
// }
