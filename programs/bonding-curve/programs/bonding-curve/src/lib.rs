use anchor_lang::prelude::*;

declare_id!("6X3W2VTp8EuLwmAQu15EL1xrXGuHLeEwi17WTPsPVMKj");
mod instructions;
mod state;
mod error;

pub use instructions::*;
pub use state::*;
#[program]
pub mod bonding_curve {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, params: GlobalSettingsInput) -> Result<()> {
        ctx.accounts.process(params)
    }

    
}
