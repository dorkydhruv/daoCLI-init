use anchor_lang::error_code;
#[error_code]
pub enum Errors {
    #[msg("council token holding account not provided")]
    NoCouncilTokenHolding,
    #[msg("quorum should be in the range of 1 and 100")]
    InvalidQuorum,
    #[msg("max recipients has been paid out")]
    MaxRecipientsPaid,
    #[msg("DAO name cannot be empty")]
    EmptyName,
    #[msg("DAO name too long")]
    NameTooLong,
    #[msg("Supply must be greater than zero")]
    InvalidSupply,
    #[msg("Min vote weight must be greater than zero")]
    InvalidMinVoteWeight,
    #[msg("Invalid quorum percentage")]
    InvalidQuorumPercentage,
    #[msg("Vote duration must be greater than zero")]
    InvalidVoteDuration,
}
