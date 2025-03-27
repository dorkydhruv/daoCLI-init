#![allow(unexpected_cfgs)]

declare_id!("6X3W2VTp8EuLwmAQu15EL1xrXGuHLeEwi17WTPsPVMKj");
mod instructions;
mod state;
mod errors;

pub use instructions::*;
pub use state::*;
#[program]
pub mod bonding_curve {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, params: GlobalSettingsInput) -> Result<()> {
        ctx.accounts.process(params)
    }

    pub fn create_bonding_curve(
        ctx: Context<CreateBondingCurve>,
        params: CreateBondingCurveParams
    ) -> Result<()> {
        ctx.accounts.process(params, &ctx.bumps)
    }
}
