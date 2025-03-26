use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace, Debug, Default)]
pub struct BondingCurve {
    pub mint: Pubkey,
    pub creator: Pubkey,
    pub initial_virtual_token_reserves: u64,
    pub virtual_sol_reserves: u64,
    pub virtual_token_reserves: u64,
    pub real_sol_reserves: u64,
    pub real_token_reserves: u64,
    pub token_total_supply: u64,
    pub start_time: i64,
    pub complete: bool,
    pub bump: u8,
    pub sol_raise_target: u64,
    pub realm_pubkey: Pubkey,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CreateBondingCurveParams {
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub start_time: Option<i64>,
    pub sol_raise_target: Option<u64>,
    pub realm_pubkey: Option<Pubkey>,
}

#[derive(Debug, Clone)]
pub struct BuyResult {
    /// Amount of tokens that the user will receive
    pub token_amount: u64,
    /// Amount of SOL that the user paid
    pub sol_amount: u64,
}

#[derive(Debug, Clone)]
pub struct SellResult {
    /// Amount of tokens that the user is selling
    pub token_amount: u64,
    /// Amount of SOL that the user will receive
    pub sol_amount: u64,
}