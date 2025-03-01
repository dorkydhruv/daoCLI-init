#![allow(unexpected_cfgs)]
use anchor_lang::prelude::*;
declare_id!("4RYGFX9e2hZZqWMXUCQTK45Hb7drhc7cUPhvgPtNkNDk");
mod instructions;
mod state;
mod error;

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
        name: String,
        min_vote_to_govern: u64,
        quorum: u8,
        vote_duration: u32
    ) -> Result<()> {
        require!(!name.is_empty(), Errors::EmptyName);
        require!(name.len() <= 32, Errors::NameTooLong);
        require!(min_vote_to_govern > 0, Errors::InvalidMinVoteWeight);
        require!(quorum > 0 && quorum <= 100, Errors::InvalidQuorum);
        require!(vote_duration > 0, Errors::InvalidVoteDuration);
        ctx.accounts.create_dao(name, vote_duration, quorum, min_vote_to_govern)?;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
