use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{ Mint, TokenAccount, TokenInterface, transfer_checked, TransferChecked },
};

use crate::state::Proposal;
use crate::error::*;
#[derive(Accounts)]
pub struct ExecuteProposal<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(mut)]
    pub target_account: SystemAccount<'info>,
    #[account(
        init_if_needed,
        payer = signer,
        associated_token::mint = token,
        associated_token::authority = target_account
    )]
    pub target_token_account: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint=token,
        associated_token::authority=proposal,
    )]
    pub proposal_token_account: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        seeds=[b"proposal",proposal.id.to_le_bytes().as_ref(),proposal.owner.as_ref()],
        bump=proposal.bump,
    )]
    pub proposal: Account<'info, Proposal>,
    pub token: InterfaceAccount<'info, Mint>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

impl<'info> ExecuteProposal<'info> {
    pub fn execute(&mut self) -> Result<()> {
        let proposal = &self.proposal;
        require!(proposal.amount_raised >= proposal.target_amount, DaoError::TargetNotReached);
        require!(!proposal.executed, DaoError::AlreadyExecuted);
        require!(self.signer.key.eq(&proposal.owner), DaoError::Unauthorized);
        let cpi_accounts = TransferChecked {
            authority: self.proposal.to_account_info(),
            from: self.proposal_token_account.to_account_info(),
            mint: self.token.to_account_info(),
            to: self.target_token_account.to_account_info(),
        };
        let signer_seeds: &[&[&[u8]]] = &[
            &[b"proposal", &proposal.id.to_le_bytes(), proposal.owner.as_ref(), &[proposal.bump]],
        ];
        let cpi_program = self.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);
        transfer_checked(cpi_ctx, proposal.amount_raised, self.token.decimals)
    }
}
