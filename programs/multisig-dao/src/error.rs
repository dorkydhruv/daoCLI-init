use anchor_lang::error_code;
#[error_code]
pub enum Errors {
    #[msg("council token holding account not provided")]
    NoCouncilTokenHolding,
    #[msg("quorum should be in the range of 1 and 100")]
    InvalidQuorum,
    #[msg("max recipients has been paid out")]
    MaxRecipientsPaid,
}