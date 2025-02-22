use anchor_lang::prelude::*;

// Serialization structs for realms and governance configuration; used for CPI calls.
#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct CreateRealmConfig {
    pub name: String,
     pub config: RealmConfigArgs,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct RealmConfigArgs {
    pub use_council_mint: bool,
    pub min_community_weight_to_create_governance: u64,
    pub community_mint_max_voter_weight_source: MintMaxVoterWeightSource,
    pub community_token_config_args: GoverningTokenConfigArgs,
    pub council_token_config_args: GoverningTokenConfigArgs,
}

#[derive(AnchorDeserialize, AnchorSerialize)]
pub struct GoverningTokenConfigArgs {
    pub use_voter_weight_addin: bool,
    pub use_max_voter_weight_addin: bool,
    pub token_type: GoverningTokenType,
}

#[derive(AnchorDeserialize, AnchorSerialize)]
pub enum GoverningTokenType {
    Liquid,
    Membership,
    Dormant,
}

#[derive(AnchorDeserialize, AnchorSerialize)]
pub enum MintMaxVoterWeightSource {
    SupplyFraction(u64),
    Absolute(u64),
}

#[derive(AnchorDeserialize, AnchorSerialize)]
pub struct GovernanceConfig {
    pub community_vote_threshold: VoteThreshold,
    pub min_community_weight_to_create_proposal: u64,
    pub min_transaction_hold_up_time: u32,
    pub voting_base_time: u32,
    pub community_vote_tipping: VoteTipping,
    pub council_vote_threshold: VoteThreshold,
    pub council_veto_vote_threshold: VoteThreshold,
    pub min_council_weight_to_create_proposal: u64,
    pub council_vote_tipping: VoteTipping,
    pub community_veto_vote_threshold: VoteThreshold,
    pub voting_cool_off_time: u32,
    pub deposit_exempt_proposal_count: u8,
}

#[derive(AnchorDeserialize, AnchorSerialize)]
pub enum VoteThreshold {
    YesVotePercentage(u8),
    QuorumPercentage(u8),
    Disabled,
}

#[derive(AnchorDeserialize, AnchorSerialize)]
pub enum VoteTipping {
    Strict,
    Early,
    Disabled,
}

#[derive(AnchorDeserialize, AnchorSerialize)]
pub struct SetRealmAuthorityArgs {
    pub action: SetRealmAuthorityAction,
}

#[derive(AnchorDeserialize, AnchorSerialize)]
pub enum SetRealmAuthorityAction {
    SetUnchecked,
    SetChecked,
    Remove,
}
