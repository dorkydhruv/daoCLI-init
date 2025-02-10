use anchor_lang::prelude::*;
#[account]
#[derive(InitSpace)]
pub struct Proposal {
    pub id: u64,
    #[max_len(32)]
    pub description: String,
    pub target_amount: u64,
    pub amount_raised: u64,
    pub executed: bool,
    pub owner: Pubkey,
    pub target_account: Pubkey,
    pub token: Pubkey,
    pub bump: u8,
}
