use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    Mint,
    TokenAccount,
    TokenInterface,
    TransferChecked,
    transfer_checked,
};

use crate::state::Proposal;

#[derive(Accounts)]
pub struct Contribute<'info> {
    #[account(mut)]
    pub contributor: Signer<'info>,
    #[account(
        mut,
        seeds=[b"proposal",proposal.id.to_le_bytes().as_ref(),proposal.owner.as_ref()],
        bump=proposal.bump,
    )]
    pub proposal: Account<'info, Proposal>,
    #[account(
        mut,
        associated_token::mint = token,
        associated_token::authority = contributor,
    )]
    pub contributor_token_account: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = token,
        associated_token::authority = proposal,
    )]
    proposal_token_account: InterfaceAccount<'info, TokenAccount>,
    pub token: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

impl<'info> Contribute<'info> {
    pub fn transfer_funds(&mut self, amount: u64) -> Result<()> {
        // Transfer tokens from contributor to proposal
        let cpi_program = self.token_program.to_account_info();
        let cpi_accounts = TransferChecked {
            authority: self.contributor.to_account_info(),
            from: self.contributor_token_account.to_account_info(),
            to: self.proposal_token_account.to_account_info(),
            mint: self.token.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        transfer_checked(cpi_ctx, amount, self.token.decimals)
    }
    pub fn update_state(&mut self, amount: u64) -> Result<()> {
        self.proposal.amount_raised += amount;
        Ok(())
    }
}
