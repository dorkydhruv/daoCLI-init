use anchor_lang::prelude::*;

#[error_code]
pub enum Errors {
    #[msg("Name cannot be empty")]
    EmptyName,
    #[msg("Name exceeds 32 bytes")]
    NameTooLong,
    #[msg("Invalid minimum vote weight")]
    InvalidMinVoteWeight,
    #[msg("Invalid quorum percentage (1-100)")]
    InvalidQuorum,
    #[msg("Invalid vote duration")]
    InvalidVoteDuration,
    #[msg("Failed to create token owner record")]
    TokenOwnerRecordCreationFailed,
    #[msg("Failed to create governance")]
    GovernanceCreationFailed,
}
