use anchor_lang::prelude::*;

use crate::{ errors::ContractError, state::{ Global, GlobalSettingsInput } };

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        init,
        seeds=[Global::SEED_PREFIX.as_bytes()],
        bump,
        constraint = global.initialized != true @ ContractError::AlreadyInitialized,
        space= 8 + Global::INIT_SPACE,
        payer=admin,
    )]
    pub global: Box<Account<'info, Global>>,
    pub system_program: Program<'info, System>,
}

impl<'info> Initialize<'info> {
    pub fn process(&mut self, params: GlobalSettingsInput, bumps: &InitializeBumps) -> Result<()> {
        self.global.update_settings(params);
        self.global.global_authority = *self.admin.key;
        self.global.initialized = true;
        self.global.bump = bumps.global;
        require_gt!(self.global.mint_decimals, 0, ContractError::InvalidArgument);
        Ok(())
    }
}
