use anchor_lang::prelude::*;

declare_id!("6X3W2VTp8EuLwmAQu15EL1xrXGuHLeEwi17WTPsPVMKj");

#[program]
pub mod bonding_curve {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
