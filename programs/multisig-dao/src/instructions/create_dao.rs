use std::u64;

use anchor_lang::prelude::*;
use anchor_lang::solana_program::{ program::invoke, instruction::Instruction };
use anchor_spl::{ associated_token::AssociatedToken, token::{ Mint, Token } };
use spl_governance::{
    instruction::{ create_realm, create_token_owner_record },
    state::{
        enums::{ MintMaxVoterWeightSource, VoteThreshold, VoteTipping },
        governance::GovernanceConfig,
        token_owner_record::get_token_owner_record_address,
    },
};

#[constant]
pub const REALMS_ID: Pubkey = pubkey!("GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw");

#[derive(Accounts)]
pub struct CreateDao<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut)]
    pub community_mint: Account<'info, Mint>,
    #[account(mut)]
    pub council_mint: Account<'info, Mint>,
    /// CHECK: CPI Account
    #[account(mut)]
    pub realm_account: UncheckedAccount<'info>,
    /// CHECK: CPI Account (community token holding)
    #[account(mut)]
    pub community_token_holding: UncheckedAccount<'info>,
    /// CHECK: CPI Account (council token holding)
    #[account(mut)]
    pub council_token_holding: UncheckedAccount<'info>,
    /// CHECK: CPI Account
    #[account(mut)]
    pub token_owner_record: UncheckedAccount<'info>,
    /// CHECK: CPI Account
    #[account(mut)]
    pub realm_config: UncheckedAccount<'info>,
    /// CHECK: CPI Account
    #[account(mut)]
    pub governance: UncheckedAccount<'info>,
    /// CHECK: CPI Account (for seeding)
    #[account(mut)]
    pub governed_account: UncheckedAccount<'info>,
    /// CHECK: CPI Account
    #[account(address = REALMS_ID, mut)]
    pub realm_program: UncheckedAccount<'info>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    /// CHECK: Rent sysvar
    pub rent: UncheckedAccount<'info>,
}

impl<'info> CreateDao<'info> {
    pub fn create_realm(&mut self, name: String) -> Result<()> {
        msg!("Creating realm with name: {}", name);

        // Verify PDA derivation
        let realm_seeds: &[&[u8]] = &[b"governance", name.as_bytes()];
        let (expected_realm_address, _) = Pubkey::find_program_address(realm_seeds, &REALMS_ID);

        if expected_realm_address != *self.realm_account.key {
            msg!("Error: Realm address mismatch!");
            return Err(ProgramError::InvalidArgument.into());
        }

        // Create the instruction using spl_governance crate
        let create_realm_ix = create_realm(
            &REALMS_ID,
            &self.payer.key(), // realm_authority
            &self.community_mint.key(), // community_token_mint
            &self.payer.key(), // payer
            Some(self.council_mint.key()), // council_token_mint
            None, // community_token_config_args
            None, // council_token_config_args
            name.clone(), // name
            0, // min_community_weight_to_create_governance
            MintMaxVoterWeightSource::FULL_SUPPLY_FRACTION // community_mint_max_voter_weight_source
        );

        // Account order MUST match exactly what SPL Governance expects
        // See spl-governance process_create_realm.rs for reference
        let account_infos = &[
            self.realm_account.to_account_info(), // 0: realm
            self.payer.to_account_info(), // 1: realm authority
            self.community_mint.to_account_info(), // 2: governance (community) token mint
            self.community_token_holding.to_account_info(), // 3: governance token holding
            self.payer.to_account_info(), // 4: payer
            self.system_program.to_account_info(), // 5: system program
            self.token_program.to_account_info(), // 6: token program
            self.rent.to_account_info(), // 7: rent sysvar
            self.council_mint.to_account_info(), // 8: council token mint
            self.council_token_holding.to_account_info(), // 9: council token holding
            self.realm_config.to_account_info(), // 10: realm config
        ];

        // Invoke the instruction with the correctly ordered accounts
        invoke(&create_realm_ix, account_infos)?;

        msg!("Realm created successfully");
        Ok(())
    }

    pub fn create_tor(&mut self) -> Result<()> {
        let creator_tor_address = get_token_owner_record_address(
            &REALMS_ID,
            &*self.realm_account.key,
            &self.community_mint.key(),
            &self.payer.key()
        );
        if creator_tor_address != *self.token_owner_record.key {
            msg!("Error: Token owner record address mismatch!");
            return Err(ProgramError::InvalidArgument.into());
        }
        msg!("Creating TOR with address: {:?}", creator_tor_address);
        let tor_ix = create_token_owner_record(
            &REALMS_ID,
            &*self.realm_account.key,
            &*self.payer.key,
            &self.community_mint.key(),
            &self.payer.key()
        );
        let account_infos = &[
            self.realm_account.to_account_info(),
            self.payer.to_account_info(),
            self.token_owner_record.to_account_info(),
            self.community_mint.to_account_info(),
            self.payer.to_account_info(),
            self.system_program.to_account_info(),
            self.rent.to_account_info(),
        ];
        invoke(&tor_ix, account_infos)?;
        msg!("Token owner record created successfully");
        Ok(())
    }

    pub fn create_governance(
        &self,
        vote_duration: u32,
        quorum: u8,
        min_vote_to_govern: u64
    ) -> Result<()> {
        msg!(
            "Creating governance with quorum: {}, min_vote_to_govern: {}, vote_duration: {}",
            quorum,
            min_vote_to_govern,
            vote_duration
        );

        // Create an array of account infos in the exact order expected by SPL governance
        let create_gov_keys = vec![
            self.realm_account.to_account_info(),
            self.governance.to_account_info(),
            self.governed_account.to_account_info(),
            self.token_owner_record.to_account_info(),
            self.payer.to_account_info(),
            self.system_program.to_account_info(),
            self.payer.to_account_info(), // realm authority
            self.realm_config.to_account_info()
        ];

        // Create a governance config with the proper settings
        let gov_config = GovernanceConfig {
            community_vote_threshold: VoteThreshold::YesVotePercentage(quorum),
            min_community_weight_to_create_proposal: min_vote_to_govern,
            min_transaction_hold_up_time: 0,
            voting_base_time: vote_duration,
            community_vote_tipping: VoteTipping::Strict,
            community_veto_vote_threshold: VoteThreshold::Disabled,
            council_veto_vote_threshold: VoteThreshold::YesVotePercentage(60),
            council_vote_threshold: VoteThreshold::YesVotePercentage(60),
            min_council_weight_to_create_proposal: 1,
            council_vote_tipping: VoteTipping::Strict,
            voting_cool_off_time: 43200,
            deposit_exempt_proposal_count: 10,
        };

        // Add instruction discriminator byte for create_governance (4)
        let mut serialize_args: Vec<u8> = vec![4];
        gov_config.serialize(&mut serialize_args)?;

        // Create the instruction manually
        let create_gov_ix = Instruction {
            program_id: self.realm_program.key(),
            accounts: create_gov_keys
                .iter()
                .flat_map(|a| a.to_account_metas(None))
                .collect(),
            data: serialize_args,
        };

        // Invoke the instruction with our account infos
        invoke(&create_gov_ix, &create_gov_keys)?;

        msg!("Governance created successfully");
        Ok(())
    }

    pub fn create_dao(
        &mut self,
        name: String,
        vote_duration: u32,
        quorum: u8,
        min_vote_to_govern: u64
    ) -> Result<()> {
        // First create realm
        self.create_realm(name)?;
        self.create_tor()?;
        self.create_governance(vote_duration, quorum, min_vote_to_govern)?;
        msg!("DAO creation completed successfully (realm created)");
        Ok(())
    }
}
