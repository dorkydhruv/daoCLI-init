# SPL Governance and Squads Multisig Integration

This document outlines the integration between SPL Governance DAO and Squads multisig that we've implemented in the daoCLI tool.

## Architecture Overview

Our solution creates a two-layer governance structure:

1. **SPL Governance Layer** - For voting, proposals, and decision-making
2. **Squads Multisig Layer** - For secure asset custody and transaction execution

This provides enhanced security with separation of concerns:

- DAO provides decentralized governance and a rich voting UI
- Squads provides battle-tested multisig execution for valuable assets

## Implementation Details

### Key Components

1. **DAO Treasury** - SPL Governance native treasury account (PDA)

   - Used for paying transaction fees
   - Source of authority for Squads transactions
   - Holds minimal SOL required for operations

2. **Squads Multisig** - Secure asset vault

   - Holds the majority of valuable assets
   - Only executes transactions approved by DAO governance
   - Same membership threshold as the DAO

3. **Token Owner Records** - Critical for proposal creation
   - Each member needs this to participate in governance
   - Created during DAO initialization

### Transaction Flow

For assets controlled by Squads multisig:

1. Create governance proposal in the DAO
2. Members vote on proposal
3. When approved, proposal execution creates transaction on Squads multisig
4. Squads multisig executes the transaction

## Command Line Interface

We've added several commands to facilitate this integration:

```
# Create integrated DAO with Squads multisig
dao init --integrated --name "My DAO" --threshold 2 --members "pubkey1,pubkey2,pubkey3"

# Fund either treasury or multisig
proposal fund --amount 0.1 --target multisig
proposal fund --amount 0.05 --target treasury

# Create proposal to transfer from multisig
proposal multisig-transfer-sol --amount 0.01 --recipient recipientAddress

# Regular DAO operations
proposal vote --proposal proposalAddress
proposal execute --proposal proposalAddress
```

## Debug Scripts

For development and testing:

1. `create-integrated-dao-fixed.ts` - Creates a complete working DAO + Squads setup
2. `test-dao-proposals.ts` - Tests proposal creation, voting and execution
3. `integrated-transfer.ts` - Tests transferring funds from the Squads multisig
4. `token-record-test.ts` - Tests token owner record creation

## Key Services

1. `GovernanceService` - Handles DAO creation and management
2. `MultisigService` - Manages Squads multisig interactions
3. `ProposalService` - Creates and manages proposals with token owner records

## Common Issues and Solutions

1. **Token Owner Records Missing**

   - Issue: Proposals fail with "account doesn't exist"
   - Solution: We now automatically create token owner records when needed

2. **Treasury/Multisig Not Funded**

   - Issue: Transactions fail due to lack of SOL
   - Solution: Added checks and funding commands

3. **Transaction Execution Timing**
   - Issue: Sometimes proposals can't execute immediately
   - Solution: Set `votingBaseTime: 0` for testing, add retry logic

## Deployment Checklist

When deploying the integrated solution:

1. ✅ Create the DAO with proper membership and threshold
2. ✅ Set up token owner records for all members
3. ✅ Fund both the native treasury (small amount) and Squads multisig (main funds)
4. ✅ Test a simple transaction flow through the entire system
5. ✅ Verify voting works properly with the configured threshold
