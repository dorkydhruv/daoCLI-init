# DAO CLI Tool - Testing Guide

This document provides a step-by-step guide for testing the DAO CLI tool, which allows you to create and manage DAOs with integrated Squads multisig support on Solana.

## Prerequisites

- Node.js (v16+)
- Yarn or npm
- Solana CLI tools (for wallet management)
- A Solana wallet with SOL for transaction fees

## Testing Commands

### 1. DAO Management

#### Create a new DAO

```bash
# Create an integrated DAO with SPL Governance and Squads Multisig
yarn dev dao init --name "Test DAO" --threshold 2 --members "pubkey1,pubkey2,pubkey3"

# Create just a standard DAO without multisig
yarn dev dao init --name "Standard DAO" --threshold 2 --members "pubkey1,pubkey2,pubkey3" --integrated false
```

#### View your DAOs

```bash
# List all DAOs where you are a member
yarn dev dao list

# Switch to a specific DAO
yarn dev dao use <REALM_ADDRESS>

# Show details about the current active DAO
yarn dev dao show
```

#### Fund your DAO

```bash
# Fund with SOL (automatically detects if it's an integrated DAO with multisig)
yarn dev dao fund --amount 0.5

# Fund with tokens
yarn dev dao fund-token --mint <TOKEN_MINT_ADDRESS> --amount 100
```

### 2. Proposal Management

#### Create Proposals

```bash
# Create a SOL transfer proposal
yarn dev proposal transfer --amount 0.1 --recipient <RECIPIENT_ADDRESS> --name "Pay Developer" --description "Payment for UI work"

# Create a token transfer proposal
yarn dev proposal transfer --mint <TOKEN_MINT_ADDRESS> --amount 50 --recipient <RECIPIENT_ADDRESS>
```

#### Vote on Proposals

```bash
# Vote to approve a proposal
yarn dev proposal vote --proposal <PROPOSAL_ADDRESS>

# Vote to deny a proposal
yarn dev proposal vote --proposal <PROPOSAL_ADDRESS> --deny
```

#### Execute Proposals

```bash
# Execute an approved proposal
yarn dev proposal execute --proposal <PROPOSAL_ADDRESS>
```

## Testing Workflow

Here's a complete testing workflow to validate all major features:

1. **Initial setup**:

   ```bash
   yarn dev wallet import ~/.config/solana/dev-wallet.json
   yarn dev wallet fund --amount 2
   ```

2. **Create an integrated DAO**:

   ```bash
   yarn dev dao init --name "Test DAO" --threshold 1
   ```

3. **Fund the multisig vault**:

   ```bash
   yarn dev dao fund --amount 0.5
   ```

4. **Create a transfer proposal**:

   ```bash
   yarn dev proposal transfer --amount 0.1 --recipient <YOUR_WALLET_ADDRESS>
   ```

5. **Vote on the proposal**:

   ```bash
   yarn dev proposal vote --proposal <PROPOSAL_ADDRESS>
   ```

6. **Execute the proposal**:

   ```bash
   yarn dev proposal execute --proposal <PROPOSAL_ADDRESS>
   ```

7. **Check your wallet balance** to confirm receipt of funds:
   ```bash
   solana balance
   ```

## Testing in Different Environments

### Local Validator

To test with a local validator:

```bash
chmod +x local-dev.sh
./local-dev.sh
solana config set --url localhost
yarn dev wallet import --path ~/.config/solana/id.json
# Airdrop some SOL to your wallet
solana airdrop 10
# Continue with the testing workflow described above
```

### Devnet

To test on Devnet:

```bash
solana config set --url devnet
yarn dev wallet import --path ~/.config/solana/id.json
solana airdrop 2
# Continue with the testing workflow described above
```

## Troubleshooting

- If you encounter errors about insufficient funds, make sure your wallet has enough SOL
- For transaction errors, check that you're using the correct account addresses
- If you see "Account not found" errors, the blockchain might be congested - try again

## Testing Edge Cases

- Test with invalid addresses
- Try executing a proposal before it's approved
- Test with insufficient funds in the treasury
- Create a multisig with a threshold higher than the member count
- Try to fund with negative or zero amounts

## Cleanup

To reset your testing environment:

```bash
rm -rf ~/.config/daoCLI  # Remove the CLI config
```

Happy testing!
