use anchor_lang::{ prelude::*, solana_program::{ instruction::Instruction, program::invoke } };
use anchor_spl::{ associated_token::AssociatedToken, token::{ Mint, MintTo, Token, TokenAccount } };
use crate::error::Errors;
use crate::args::*;

#[constant]
pub const REALMS_ID: Pubkey = pubkey!("GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw");

#[derive(Accounts)]
pub struct CreateDao<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    /// CHECK: Optional council mint account
    #[account(mut)]
    pub council_mint: Option<Account<'info, Mint>>,
    /// CHECK: CPI Account
    #[account(mut)]
    pub realm_account: UncheckedAccount<'info>,
    /// CHECK: CPI Account
    #[account(mut)]
    pub community_token_holding: UncheckedAccount<'info>,
    /// CHECK: CPI Account
    #[account(mut)]
    pub council_token_holding: Option<UncheckedAccount<'info>>,
    /// CHECK: CPI Account
    #[account(mut)]
    pub realm_config: UncheckedAccount<'info>,
    /// CHECK: CPI Account
    #[account(mut)]
    pub governance: UncheckedAccount<'info>,
    /// CHECK: CPI Account (for seeding)
    pub governed_account: UncheckedAccount<'info>,
    /// CHECK: CPI Account
    #[account(mut)]
    pub native_treasury: UncheckedAccount<'info>,
    #[account(
        init,
        payer = signer,
        associated_token::mint = mint,
        associated_token::authority = native_treasury
    )]
    pub dao_token_account: Account<'info, TokenAccount>,
    /// CHECK: CPI Account
    #[account(address = REALMS_ID)]
    pub realm_program: UncheckedAccount<'info>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

impl<'info> CreateDao<'info> {
    pub fn create_dao(
        &mut self,
        name: String,
        min_vote_to_govern: u64,
        is_council: bool
    ) -> Result<()> {
        let mut create_realm_keys = vec![
            self.realm_account.to_account_info(),
            self.signer.to_account_info(),
            self.mint.to_account_info(),
            self.community_token_holding.to_account_info(),
            self.signer.to_account_info(),
            self.system_program.to_account_info(),
            self.token_program.to_account_info(),
            self.rent.to_account_info()
        ];
        if is_council {
            if let Some(council_mint) = self.council_mint.as_ref() {
                if let Some(council_token_holding) = self.council_token_holding.as_ref() {
                    create_realm_keys.push(council_mint.to_account_info());
                    create_realm_keys.push(council_token_holding.to_account_info());
                } else {
                    return Err(Errors::NoCouncilTokenHolding.into());
                }
            };
        }
        create_realm_keys.push(self.realm_config.to_account_info());
        let create_realm_args = CreateRealmConfig {
            name,
            config: RealmConfigArgs {
                use_council_mint: is_council,
                min_community_weight_to_create_governance: min_vote_to_govern,
                community_mint_max_voter_weight_source: MintMaxVoterWeightSource::SupplyFraction(
                    10000000000
                ),
                community_token_config_args: GoverningTokenConfigArgs {
                    use_max_voter_weight_addin: false,
                    use_voter_weight_addin: false,
                    token_type: GoverningTokenType::Liquid,
                },
                council_token_config_args: GoverningTokenConfigArgs {
                    use_max_voter_weight_addin: false,
                    use_voter_weight_addin: false,
                    token_type: GoverningTokenType::Membership,
                },
            },
        };
        let mut serialize_args: Vec<u8> = vec![0];
        create_realm_args.serialize(&mut serialize_args)?;

        let create_realm_ix = Instruction {
            program_id: self.realm_program.key(),
            accounts: create_realm_keys.to_account_metas(None),
            data: serialize_args,
        };
        invoke(&create_realm_ix, &create_realm_keys)?;
        Ok(())
    }
    pub fn create_governance(
        &self,
        vote_duration: u32,
        quorum: u8,
        min_vote_to_govern: u64
    ) -> Result<()> {
        require_gte!(100, quorum, Errors::InvalidQuorum);
        require_gte!(quorum, 0, Errors::InvalidQuorum);

        let create_gov_keys = vec![
            self.realm_account.to_account_info(),
            self.governance.to_account_info(),
            self.governed_account.to_account_info(),
            self.system_program.to_account_info(),
            self.signer.to_account_info(),
            self.system_program.to_account_info(),
            self.signer.to_account_info(),
            self.realm_config.to_account_info()
        ];

        let create_gov_args = GovernanceConfig {
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

        let mut serialize_args: Vec<u8> = vec![4];
        create_gov_args.serialize(&mut serialize_args)?;

        let create_gov_ix = Instruction {
            program_id: self.realm_program.key(),
            accounts: create_gov_keys.to_account_metas(None),
            data: serialize_args,
        };

        invoke(&create_gov_ix, &create_gov_keys)?;

        Ok(())
    }

    // Sets up a native treasury for the DAO.
    pub fn create_native_treasury(&self) -> Result<()> {
        let create_treasury_keys = vec![
            self.governance.to_account_info(),
            self.native_treasury.to_account_info(),
            self.signer.to_account_info(),
            self.system_program.to_account_info()
        ];

        let create_treasury_ix = Instruction {
            program_id: self.realm_program.key(),
            accounts: create_treasury_keys.to_account_metas(None),
            data: vec![25],
        };

        invoke(&create_treasury_ix, &create_treasury_keys)?;
        Ok(())
    }

    // Updates the authority of the realm through CPI.
    pub fn set_realm_authority(&self) -> Result<()> {
        let set_authority_keys = vec![
            self.realm_account.to_account_info(),
            self.signer.to_account_info(),
            self.governance.to_account_info()
        ];

        let set_authority_args = SetRealmAuthorityArgs {
            action: SetRealmAuthorityAction::SetChecked,
        };

        let mut serialized_args = vec![21];
        set_authority_args.serialize(&mut serialized_args)?;

        let set_authority_ix = Instruction {
            program_id: self.realm_program.key(),
            accounts: set_authority_keys.to_account_metas(None),
            data: serialized_args,
        };

        invoke(&set_authority_ix, &set_authority_keys)?;
        Ok(())
    }

    // Constructs context for minting DAO allocation tokens.
    pub fn mint_dao_allocation(&self) -> CpiContext<'_, '_, '_, 'info, MintTo<'info>> {
        let cpi_program = self.token_program.to_account_info();
        let cpi_accounts = MintTo {
            to: self.dao_token_account.to_account_info(),
            authority: self.signer.to_account_info(),
            mint: self.mint.to_account_info(),
        };

        CpiContext::new(cpi_program, cpi_accounts)
    }
}
