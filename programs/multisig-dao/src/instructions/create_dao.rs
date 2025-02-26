use anchor_lang::prelude::*;
use anchor_lang::solana_program::{ instruction::Instruction, program::invoke };
use anchor_spl::{ associated_token::AssociatedToken, token::{ Mint, Token } };
// use solana_sdk::{ signature::Keypair, signer::Signer as _ };
use spl_governance::{
    instruction::create_realm,
    instruction::create_governance,
    processor::process_instruction,
    state::enums::MintMaxVoterWeightSource,
};

#[constant]
pub const REALMS_ID: Pubkey = pubkey!("GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw");

#[derive(Accounts)]
pub struct CreateDao<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>, // new field for payer
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

        // IMPORTANT: Verify PDA derivation explicitly
        let realm_seeds: &[&[u8]] = &[b"governance", name.as_bytes()];
        let (expected_realm_address, _) = Pubkey::find_program_address(realm_seeds, &REALMS_ID);

        msg!("Expected realm address: {:?}", expected_realm_address);
        msg!("Provided realm address: {:?}", self.realm_account.key());

        if expected_realm_address != *self.realm_account.key {
            msg!("Error: Realm address mismatch!");
            return Err(ProgramError::InvalidArgument.into());
        }

        // Create a raw instruction to call directly rather than using process_instruction
        let create_realm_ix = create_realm(
            &REALMS_ID,
            &self.payer.key,
            &self.community_mint.key(),
            &self.payer.key,
            Some(self.council_mint.key()),
            None,
            None,
            name,
            0,
            MintMaxVoterWeightSource::FULL_SUPPLY_FRACTION
        );

        // Convert AccountInfos to Instruction format
        let create_realm_accounts = vec![
            AccountMeta::new(self.realm_account.key(), false),
            AccountMeta::new_readonly(self.payer.key(), true), // Mark as signer
            AccountMeta::new_readonly(self.community_mint.key(), false),
            AccountMeta::new(self.community_token_holding.key(), false),
            AccountMeta::new(self.payer.key(), true), // Mark as signer
            AccountMeta::new_readonly(self.system_program.key(), false),
            AccountMeta::new_readonly(self.token_program.key(), false),
            AccountMeta::new_readonly(self.rent.key(), false),
            AccountMeta::new_readonly(self.council_mint.key(), false),
            AccountMeta::new(self.council_token_holding.key(), false),
            AccountMeta::new(self.realm_config.key(), false)
        ];

        // Create the instruction object
        let realm_ix = Instruction {
            program_id: REALMS_ID,
            accounts: create_realm_accounts,
            data: create_realm_ix.data,
        };

        // Use invoke instead of process_instruction - only using the needed accounts
        invoke(
            &realm_ix,
            &[
                self.realm_account.to_account_info(),
                self.payer.to_account_info(),
                self.community_mint.to_account_info(),
                self.community_token_holding.to_account_info(),
                self.system_program.to_account_info(),
                self.token_program.to_account_info(),
                self.rent.to_account_info(),
                self.council_mint.to_account_info(),
                self.council_token_holding.to_account_info(),
                self.realm_config.to_account_info(),
            ]
        )?;

        Ok(())
    }
    // pub fn create_governance(
    //     &self,
    //     vote_duration: u32,
    //     quorum: u8,
    //     min_vote_to_govern: u64
    // ) -> Result<()> {

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
