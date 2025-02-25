use anchor_lang::prelude::*;
use anchor_spl::{ associated_token::AssociatedToken, token::{ Mint, Token } };
use spl_governance::{
    instruction::create_realm,
    processor::process_instruction,
    state::enums::MintMaxVoterWeightSource::SupplyFraction,
    state::enums::MintMaxVoterWeightSource,
};

#[constant]
pub const REALMS_ID: Pubkey = pubkey!("GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw");

#[derive(Accounts)]
pub struct CreateDao<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(mut)]
    pub council_mint: Account<'info, Mint>,
    /// CHECK: CPI Account
    #[account(mut)]
    pub realm_account: UncheckedAccount<'info>,
    /// CHECK: CPI Account
    #[account(mut)]
    pub governance: UncheckedAccount<'info>,
    /// CHECK: CPI Account (for seeding)
    pub governed_account: UncheckedAccount<'info>,
    /// CHECK: CPI Account
    #[account(address = REALMS_ID)]
    pub realm_program: UncheckedAccount<'info>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

impl<'info> CreateDao<'info> {
    pub fn create_realm(&mut self, name: String) -> Result<()> {
        let create_realm_ix = create_realm(
            &REALMS_ID,
            &self.signer.key,
            &self.council_mint.key(),
            &self.signer.key,
            Some(self.council_mint.key()),
            None,
            None,
            name,
            1, // Must be nonzero
            MintMaxVoterWeightSource::SupplyFraction(1) // Nonzero fraction
        );

        process_instruction(
            &REALMS_ID,
            &[
                self.signer.to_account_info(),
                self.council_mint.to_account_info(),
                self.realm_account.to_account_info(),
                self.realm_program.to_account_info(),
                self.governance.to_account_info(),
                self.governed_account.to_account_info(),
                self.associated_token_program.to_account_info(),
                self.token_program.to_account_info(),
                self.system_program.to_account_info(),
            ],
            &create_realm_ix.data
        )?;
        Ok(())
    }
    // pub fn create_governance(
    //     &self,
    //     vote_duration: u32,
    //     quorum: u8,
    //     min_vote_to_govern: u64
    // ) -> Result<()> {
    //     require_gte!(100, quorum, Errors::InvalidQuorum);
    //     require_gte!(quorum, 0, Errors::InvalidQuorum);

    //     let create_gov_keys = vec![
    //         self.realm_account.to_account_info(),
    //         self.governance.to_account_info(),
    //         self.governed_account.to_account_info(),
    //         self.system_program.to_account_info(),
    //         self.signer.to_account_info(),
    //         self.system_program.to_account_info(),
    //         self.signer.to_account_info(),
    //         self.realm_config.to_account_info()
    //     ];

    //     let create_gov_args = GovernanceConfig {
    //         community_vote_threshold: VoteThreshold::YesVotePercentage(quorum),
    //         min_community_weight_to_create_proposal: min_vote_to_govern,
    //         min_transaction_hold_up_time: 0,
    //         voting_base_time: vote_duration,
    //         community_vote_tipping: VoteTipping::Strict,
    //         community_veto_vote_threshold: VoteThreshold::Disabled,
    //         council_veto_vote_threshold: VoteThreshold::YesVotePercentage(60),
    //         council_vote_threshold: VoteThreshold::YesVotePercentage(60),
    //         min_council_weight_to_create_proposal: 1,
    //         council_vote_tipping: VoteTipping::Strict,
    //         voting_cool_off_time: 43200,
    //         deposit_exempt_proposal_count: 10,
    //     };

    //     let mut serialize_args: Vec<u8> = vec![4];
    //     create_gov_args.serialize(&mut serialize_args)?;

    //     let create_gov_ix = Instruction {
    //         program_id: self.realm_program.key(),
    //         accounts: create_gov_keys.to_account_metas(None),
    //         data: serialize_args,
    //     };

    //     invoke(&create_gov_ix, &create_gov_keys)?;

    //     Ok(())
    // }

    // // Sets up a native treasury for the DAO.
    // pub fn create_native_treasury(&self) -> Result<()> {
    //     let create_treasury_keys = vec![
    //         self.governance.to_account_info(),
    //         self.native_treasury.to_account_info(),
    //         self.signer.to_account_info(),
    //         self.system_program.to_account_info()
    //     ];

    //     let create_treasury_ix = Instruction {
    //         program_id: self.realm_program.key(),
    //         accounts: create_treasury_keys.to_account_metas(None),
    //         data: vec![25],
    //     };

    //     invoke(&create_treasury_ix, &create_treasury_keys)?;
    //     Ok(())
    // }

    // // Updates the authority of the realm through CPI.
    // pub fn set_realm_authority(&self) -> Result<()> {
    //     let set_authority_keys = vec![
    //         self.realm_account.to_account_info(),
    //         self.signer.to_account_info(),
    //         self.governance.to_account_info()
    //     ];

    //     let set_authority_args = SetRealmAuthorityArgs {
    //         action: SetRealmAuthorityAction::SetChecked,
    //     };

    //     let mut serialized_args = vec![21];
    //     set_authority_args.serialize(&mut serialized_args)?;

    //     let set_authority_ix = Instruction {
    //         program_id: self.realm_program.key(),
    //         accounts: set_authority_keys.to_account_metas(None),
    //         data: serialized_args,
    //     };

    //     invoke(&set_authority_ix, &set_authority_keys)?;
    //     Ok(())
    // }

    // // Constructs context for minting DAO allocation tokens.
    // pub fn mint_dao_allocation(&self) -> CpiContext<'_, '_, '_, 'info, MintTo<'info>> {
    //     let cpi_program = self.token_program.to_account_info();
    //     let cpi_accounts = MintTo {
    //         to: self.dao_token_account.to_account_info(),
    //         authority: self.signer.to_account_info(),
    //         mint: self.mint.to_account_info(),
    //     };

    //     CpiContext::new(cpi_program, cpi_accounts)
    // }
}
