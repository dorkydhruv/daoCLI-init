# Creating a Multisig Contract DAO with Squads and SPL Governance

## Overview

This document outlines the steps to create a Solana program that combines the features of a Squads multisig wallet with the governance capabilities of SPL Governance. The goal is to create a DAO where proposals can be created and voted on by members of a Squad, and actions are executed through the Squad's multisig mechanism.

## Thought Process

1.  **Leverage Existing Programs:** Instead of reinventing the wheel, we'll integrate with existing, well-audited programs:
    - **Squads:** For multisig wallet functionality (managing funds, executing transactions).
    - **SPL Governance:** For creating and voting on proposals.
2.  **Bridge the Gap:** The core of our program will be the logic that connects SPL Governance with Squads. This involves:
    - Allowing Squad members to create proposals within the SPL Governance realm.
    - Ensuring that successful proposals trigger transactions executed by the Squad.
3.  **Context from Governance Program Library:**
    - We can use the plugin architecture demonstrated in the governance-program-library to extend SPL Governance functionality.
    - The `Registrar`, `VoterWeightRecord` pattern can be adapted to manage Squad membership and voting power.

## Steps

1.  **Set up Development Environment:**

    - Install Solana CLI, Anchor, and other necessary tools.
    - Create a new Anchor project.

2.  **Define Program State:**

    - **DAO Account:** Stores the configuration for the DAO.
      - `governance_program_id`: Pubkey of the SPL Governance program.
      - `realm`: Pubkey of the SPL Governance realm.
      - `squads_program_id`: Pubkey of the Squads program.
      - `squad`: Pubkey of the Squads instance.
      - `threshold`: Number of signatures required for Squad transactions.
      - `members`: List of Squad members (Pubkeys).
    - **Voter Account:** (Optional, if needed for custom voting logic)
      - `voter_authority`: Pubkey of the voter (Squad member).
      - `voter_weight`: Voting power of the voter.

3.  **Implement Instructions:**

    - **`create_dao`:**
      - Initializes the DAO account.
      - Verifies that the provided Squad exists and that the `threshold` is valid.
      - Creates a corresponding Realm in SPL Governance.
    - **`create_proposal`:**
      - Allows a Squad member to create a proposal in the SPL Governance realm.
      - Verifies that the creator is a member of the Squad.
      - Stores the proposal details (description, actions to be executed).
    - **`cast_vote`:**
      - Allows Squad members to cast votes on a proposal.
      - Verifies that the voter is a member of the Squad.
      - Updates the voting power based on a custom logic (e.g., equal weight for all members, weighted by token holdings).
    - **`execute_proposal`:**
      - Executes a successful proposal.
      - Verifies that the proposal has passed (reached the required threshold in SPL Governance).
      - Constructs a transaction based on the proposal's actions.
      - Submits the transaction to the Squad for execution.
    - **`configure_mint`:**
      - Allows the DAO to configure which mints are allowed for voting.
    - **`resize_registrar`:**
      - Allows the DAO to resize the registrar account to accommodate more mints.

4.  **Integrate with Squads:**

    - Use the Squads SDK to interact with the Squads program.
    - Implement the logic to construct and submit transactions to the Squad for execution.
    - Handle multisig confirmations and transaction execution.

5.  **Integrate with SPL Governance:**

    - Use the SPL Governance SDK to interact with the SPL Governance program.
    - Implement the logic to create realms, proposals, and cast votes.
    - Fetch proposal states and determine if a proposal has passed.

6.  **Adapt Governance Program Library Concepts:**

    - **Registrar:** The `DAO Account` serves a similar purpose to the `Registrar` in the example programs, storing configuration information.
    - **VoterWeightRecord:** The `Voter Account` (if used) is analogous to the `VoterWeightRecord`, managing voting power.
    - **Plugins:** Consider using the plugin architecture to extend the functionality of the DAO, such as adding support for different voting mechanisms or token-based voting.

7.  **Testing and Auditing:**
    - Write thorough tests to ensure the program functions correctly and is secure.
    - Consider getting the program audited by a reputable security firm.

## Creating Realms and Multisig

1. Deploy or reference the SPL Governance program.
2. Call the `create_dao` instruction in your multisig-dao program, passing in:
   - `governance_program_id`
   - `realm` (new or existing)
   - `squads_program_id`
   - `squad` (multisig account)
3. Initialize your realm by running the SPL Governance setup commands (if not already created).
4. Use Squads to create and configure a multisig with a chosen threshold and set of members.
5. Invoke `create_proposal` to register proposals within SPL Governance.
6. Let members cast votes with `cast_vote`.
7. Upon successful vote, execute proposals with `execute_proposal`, which composes a transaction for the Squad to execute.

For detailed steps on each instruction, see comments in the code and the Squads/SPL Governance documentation.

## Multisig DAO Creation Steps

1. Deploy or reference the SPL Governance program.
2. Invoke the `create_dao` instruction with:
   - governance_program_id (SPL Governance)
   - realm (newly created or existing realm)
   - squads_program_id (Squads)
   - squad (the multisig account)
3. Use the Squads SDK to create/configure your multisig:
   - Set the threshold number of required signatures.
   - Add Squad members.
4. Create proposals by calling `create_proposal`:
   - Ensure the caller is a Squad member.
   - Store the proposal details (description and intended actions).
5. Cast votes via `cast_vote`:
   - Validate that voters are Squad members.
   - Update voting records in SPL Governance.
6. When a proposal reaches the required threshold, call `execute_proposal`:
   - Verify the proposal has passed.
   - Construct and submit the corresponding transaction through the multisig.

## Code Snippets (Illustrative)

```rust
// Example: create_dao instruction
#[derive(Accounts)]
pub struct CreateDao<'info> {
    #[account(init, payer = payer, space = ...)]
    pub dao: Account<'info, Dao>,
    pub squads_program: UncheckedAccount<'info>, // Verify is Squads program
    pub squads: UncheckedAccount<'info>, // Verify is Squads account
    pub realm_authority: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct Dao {
    pub governance_program_id: Pubkey,
    pub realm: Pubkey,
    pub squads_program_id: Pubkey,
    pub squad: Pubkey,
    pub threshold: u64,
    pub members: Vec<Pubkey>,
}
```
