use anchor_lang::error_code;

#[error_code]
pub enum DaoError {
    #[msg("Target amount not reached.")]
    TargetNotReached,
    #[msg("Proposal already executed.")]
    AlreadyExecuted,
    #[msg("Unauthorized.")]
    Unauthorized,
}