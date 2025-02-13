use anchor_lang::prelude::*;

declare_id!("4ME7WnEPrZT6DtTva6c56z3nRewkZQLqRyJtM43T1KEE");

pub mod instructions;
pub mod state;
pub mod error;
use instructions::*;

#[program]
pub mod dao_contract {
    use super::*;

    // Creates a proposal with a given id, description and target amount
    pub fn create_proposal(
        ctx: Context<CreateProposel>,
        proposal_id: String,
        description: String,
        target_amount: u64,
        target_account: Pubkey
    ) -> Result<()> {
        ctx.accounts.create_proposal(
            proposal_id,
            description,
            target_amount,
            target_account,
            &ctx.bumps
        )
    }

    // Contributes to a proposal, given we know the account of the proposel account.
    pub fn contribute(ctx: Context<Contribute>, amount: u64) -> Result<()> {
        ctx.accounts.transfer_funds(amount)?;
        ctx.accounts.update_state(amount)
    }

    pub fn execute_proposal(ctx: Context<ExecuteProposal>) -> Result<()> {
        ctx.accounts.execute()
    }
}
