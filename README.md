# Solana DAO CLI Tool

A powerful command-line interface for creating and managing Decentralized Autonomous Organizations (DAOs) on the Solana blockchain. This tool enables seamless integration between SPL Governance and Squads multisig, offering a complete solution for DAO management directly from your terminal.

![Solana DAO CLI Tool](./docs/images/banner.png)

## 🌟 Features

- **DAO Creation**: Create standard DAOs or integrated DAOs with Squads multisig support
- **Treasury Management**: Fund and manage both DAO treasury and multisig vaults
- **Proposal Creation**: Create SOL or token transfer proposals
- **Voting System**: Vote to approve or deny proposals
- **Execution**: Execute approved proposals
- **Wallet Management**: Import, create, and fund wallets

## 📋 Prerequisites

- Node.js (v16+)
- Yarn or npm
- Solana CLI tools (for wallet management)
- A Solana wallet with SOL for transaction fees

## 🚀 Installation

Clone the repository and install dependencies:

```bash
# Clone the repository
git clone https://github.com/dorkydhruv/daoCLI-init.git
cd daoCLI-init

# Install dependencies
yarn install

# Build the project
yarn build

# Link the CLI tool globally (optional)
npm link
```

## ⚙️ Configuration

By default, the CLI connects to a local Solana validator. You can change the network:

```bash
# Set network to devnet
daocli config set-cluster devnet

# Set network to mainnet
daocli config set-cluster mainnet

# Set to local validator
daocli config set-cluster localhost
```

## 🔑 Wallet Setup

Before using the DAO CLI, you need to set up a wallet:

```bash
# Import an existing wallet
daocli wallet import ~/.config/solana/id.json

# Create a new wallet
daocli wallet create

# Check wallet config
daocli wallet show
```

## 📘 Usage Guide

### Creating a DAO

```bash
# Create an integrated DAO with Squads multisig
daocli dao init --name "My DAO" --threshold 2 --members "pubkey1,pubkey2,pubkey3"

# Create a standard DAO without multisig integration
daocli dao init --name "Standard DAO" --threshold 2 --members "pubkey1,pubkey2,pubkey3" --integrated false
```

### Managing Your DAOs

```bash
# List all DAOs where you are a member
daocli dao list

# Switch to a specific DAO
daocli dao use <REALM_ADDRESS>

# Show details about the current active DAO
daocli dao show
```

### Funding Your DAO

```bash
# Fund with SOL (automatically detects if it's a treasury or multisig vault)
daocli dao fund --amount 0.5

# Fund with tokens
daocli dao fund-token --mint <TOKEN_MINT_ADDRESS> --amount 100
```

### Creating Proposals

```bash
# Create a SOL transfer proposal
daocli proposal transfer --amount 0.1 --recipient <RECIPIENT_ADDRESS> --name "Pay Developer" --description "Payment for UI work"

# Create a token transfer proposal
daocli proposal transfer --mint <TOKEN_MINT_ADDRESS> --amount 50 --recipient <RECIPIENT_ADDRESS>
```

### Voting and Execution

```bash
# List all proposals
daocli proposal list

# Vote to approve a proposal
daocli proposal vote --proposal <PROPOSAL_ADDRESS>

# Vote to deny a proposal
daocli proposal vote --proposal <PROPOSAL_ADDRESS> --deny

# Execute an approved proposal
daocli proposal execute --proposal <PROPOSAL_ADDRESS>
```

## 🧪 Testing

### Automated Tests

The project includes automated tests for both standard and integrated DAO workflows:

```bash
# Run all tests
yarn test

# Run specific test suites
yarn test:integrated  # For integrated DAO tests
yarn test:standard    # For standard DAO tests
```

### Testing Environments

#### Local Validator

```bash
# Start a local validator
chmod +x local-dev.sh
./local-dev.sh

# Configure Solana to use localhost
solana config set localhost

# Import your wallet
daocli wallet import ~/.config/solana/id.json

# Airdrop SOL to your wallet
solana airdrop 10
```

#### Devnet

```bash
# Configure Solana to use devnet
solana config set devnet

# Import your wallet
daocli wallet import ~/.config/solana/id.json

# Airdrop SOL to your wallet
solana airdrop 2
```

### Complete Testing Workflow

Here's a step-by-step workflow to test all major features:

1. **Initial setup**:

   ```bash
   daocli wallet import ~/.config/solana/dev-wallet.json
   daocli wallet balance
   ```

2. **Create a DAO**:

   ```bash
   daocli dao init --name "Test DAO" --threshold 1
   ```

3. **Fund the DAO**:

   ```bash
   daocli dao fund --amount 0.5
   ```

4. **Create a proposal**:

   ```bash
   daocli proposal transfer --amount 0.1 --recipient <ADDRESS>
   ```

5. **Vote on the proposal**:

   ```bash
   daocli proposal vote --proposal <PROPOSAL_ADDRESS>
   ```

6. **Verify the transfer**:
   ```bash
   solana balance -u <RECIPIENT_ADDRESS>
   ```

## 🏗️ Project Structure

```
daoCLI-init/
├── src/
│   ├── commands/         # CLI command implementations
│   ├── services/         # Core business logic
│   ├── utils/            # Utility functions
│   ├── types/            # TypeScript type definitions
│   ├── debug/            # Debug scripts for testing
│   └── index.ts          # Entry point
├── tests/                # Test files
├── dist/                 # Compiled output
└── docs/                 # Documentation
```

## 🧩 Architecture

The application integrates two key Solana programs:

1. **SPL Governance**: For DAO creation, proposal management, and voting
2. **Squads Multisig**: For multi-signature transaction approval

For integrated DAOs, the tool creates a governance structure where proposals can control a multisig vault, enabling more complex treasury management with the security of multisig approvals.

## 🛠️ Development

To set up a development environment:

```bash
# Clone the repository
git clone https://github.com/DaoCLI/daoCLI-init.git
cd daoCLI-init

# Install dependencies
yarn install

# Run in development mode
yarn dev

# Build the project
yarn build
```

## 🔍 Troubleshooting

- **Insufficient funds errors**: Ensure your wallet has enough SOL
- **Transaction errors**: Verify that you're using correct account addresses
- **"Account not found" errors**: The blockchain might be congested; try again
- **Proposal execution failures**: Make sure the proposal has been approved

## 🧹 Cleanup

To reset your local configuration:

```bash
rm -rf ~/.config/dao-cli
```

## 📜 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- [Solana Foundation](https://solana.com)
- [SPL Governance Program](https://github.com/solana-labs/solana-program-library/tree/master/governance)
- [Squads Multisig](https://squads.so)

---

Built with ❤️ for the Solana ecosystem
