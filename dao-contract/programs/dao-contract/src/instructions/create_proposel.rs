use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{ Mint, TokenAccount, TokenInterface },
};

use crate::state::Proposal;

#[derive(Accounts)]
#[instruction(proposal_id:u64)]
pub struct CreateProposel<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init,
        payer = payer,
        space = 8 + Proposal::INIT_SPACE,
        seeds = [b"proposal", proposal_id.to_le_bytes().as_ref(), payer.key().as_ref()],
        bump
    )]
    pub proposal: Account<'info, Proposal>,
    #[account(
        init,
        payer = payer,
        associated_token::mint = token,
        associated_token::authority = proposal
    )]
    pub proposal_token_account: InterfaceAccount<'info, TokenAccount>,
    pub token: InterfaceAccount<'info, Mint>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

impl<'info> CreateProposel<'info> {
    pub fn create_proposal(
        &mut self,
        proposal_id: u64,
        description: String,
        target_amount: u64,
        target_account: Pubkey,
        bumps: &CreateProposelBumps
    ) -> Result<()> {
        self.proposal.set_inner(Proposal {
            id: proposal_id,
            description,
            target_amount,
            amount_raised: 0,
            executed: false,
            target_account,
            owner: self.payer.key(),
            token: self.token.key(),
            bump: bumps.proposal,
        });
        Ok(())
    }
}
