#[derive(Accounts)]
#[instruction(fundraise_target: u64, min_pool_price: u64, expiry_timestamp: i64)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = manager,
        space = 8 + DAOState::SIZE,
        seeds = [b"dao", dao_token.key().as_ref()],
        bump,
    )]
    pub dao_state: Account<'info, DAOState>,

    #[account(
        seeds = [b"treasury", dao_state.key().as_ref()],
        bump,
    )]
    /// CHECK: PDA owned by program
    pub treasury: AccountInfo<'info>,

    #[account(mut)]
    pub manager: Signer<'info>,
    pub dao_token: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}
