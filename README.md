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
- **[Model Context Protocol (MCP)](https://modelcontextprotocol.github.io/)**: Natural language interaction with your DAOs

## Navigation

- [CLI Interface](#cli-interface): Traditional command-line interface
- [MCP Interface](#model-context-protocol-mcp-interface): Natural language AI-assisted interface

## CLI Interface

### 📋 Prerequisites

- Node.js (v16+)
- Yarn or npm
- Solana CLI tools (for wallet management)
- A Solana wallet with SOL for transaction fees

### 🚀 Installation

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

### ⚙️ Configuration

By default, the CLI connects to a local Solana validator. You can change the network:

```bash
# Set network to devnet
daocli config set-cluster devnet

# Set network to mainnet
daocli config set-cluster mainnet

# Set to local validator
daocli config set-cluster localhost
```

### 🔑 Wallet Setup

Before using the DAO CLI, you need to set up a wallet:

```bash
# Import an existing wallet
daocli wallet import ~/.config/solana/id.json

# Create a new wallet
daocli wallet create

# Check wallet config
daocli wallet show
```

### 📘 Usage Guide

#### Creating a DAO

```bash
# Create an integrated DAO with Squads multisig
daocli dao init --name "My DAO" --threshold 2 --members "pubkey1,pubkey2,pubkey3"

# Create a standard DAO without multisig integration
daocli dao init --name "Standard DAO" --threshold 2 --members "pubkey1,pubkey2,pubkey3" --integrated false
```

#### Managing Your DAOs

```bash
# List all DAOs where you are a member
daocli dao list

# Switch to a specific DAO
daocli dao use <REALM_ADDRESS>

# Show details about the current active DAO
daocli dao show
```

#### Funding Your DAO

```bash
# Fund with SOL (automatically detects if it's a treasury or multisig vault)
daocli dao fund --amount 0.5

# Fund with tokens
daocli dao fund-token --mint <TOKEN_MINT_ADDRESS> --amount 100
```

#### Creating Proposals

```bash
# Create a SOL transfer proposal
daocli proposal transfer --amount 0.1 --recipient <RECIPIENT_ADDRESS> --name "Pay Developer" --description "Payment for UI work"

# Create a token transfer proposal
daocli proposal transfer --mint <TOKEN_MINT_ADDRESS> --amount 50 --recipient <RECIPIENT_ADDRESS>
```

#### Voting and Execution

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

### 🧪 Testing the CLI

#### Automated Tests

The project includes automated tests for both standard and integrated DAO workflows:

```bash
# Run all tests
yarn test

# Run specific test suites
yarn test:integrated  # For integrated DAO tests
yarn test:standard    # For standard DAO tests
```

#### Testing Environments

##### Local Validator

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

##### Devnet

```bash
# Configure Solana to use devnet
solana config set devnet

# Import your wallet
daocli wallet import ~/.config/solana/id.json

# Airdrop SOL to your wallet
solana airdrop 2
```

#### Complete Testing Workflow

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

---

## Model Context Protocol (MCP) Interface

This tool also features a powerful [Model Context Protocol (MCP)](https://modelcontextprotocol.github.io/) interface that allows users to interact with DAOs using natural language commands through compatible AI clients like Claude Desktop.

### Setting Up the MCP Interface

#### Prerequisites

- A compatible MCP client (e.g., [Claude Desktop](https://claude.ai/desktop), GPT-4 with MCP integration)
- Node.js (v16+)

### Configuration

#### Setting up Claude Desktop MCP server

1. Change the Claude Desktop MCP server settings:

For MacOS:

```bash
code ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

For Windows:

```bash
code $env:AppData\Claude\claude_desktop_config.json
```

The final configuration should look like the following (replace the path with your absolute project path):

```json
{
  "mcpServers": {
    "daoCLI": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/YOUR/PROJECT"]
    }
  }
}
```

### Using Natural Language Commands

The MCP interface supports natural language commands. Here are examples of what you can ask:

#### Configuration and Setup

```
Set my cluster to devnet
Import my wallet from ~/.config/solana/id.json
Show me my wallet information
What's the current configuration?
```

#### Creating and Managing DAOs

```
Create a new integrated DAO called "Community Fund" with 3 members and a threshold of 2
Create a standard DAO named "Charity DAO" with these members: [pubkey1, pubkey2] and a threshold of 1
Show me all the DAOs I'm a member of
I want to use the DAO with address abc123...
Tell me about my current DAO
```

#### Funding Operations

```
Fund my DAO treasury with 0.5 SOL
Send 100 tokens to my multisig vault from the mint address xyz789...
What's the balance of my DAO treasury?
```

#### Proposal Operations

```
Create a proposal to send 0.1 SOL to address abc123... with title "Web Development Fee"
Make a token transfer proposal to send 50 USDC to our developer
Show me all active proposals for my DAO
I want to vote yes on proposal abc123...
Vote against the proposal xyz789...
Execute the approved proposal abc123...
```

#### Utility Operations

```
Get the balance of address abc123...
Look up transaction signature xyz789...
What happened in transaction abc123...?
```

### MCP Documentation Resources

Access detailed documentation through the MCP interface:

```
GET daocli://docs/readme
GET daocli://docs/dao-guide
GET daocli://docs/proposal-guide
GET daocli://docs/wallet-guide
```

### MCP Testing Workflow

Test the MCP functionality with this step-by-step workflow:

1. **Start the MCP server**:

   ```bash
   yarn start:mcp
   ```

2. **Connect with your MCP client** and set up your environment:

   ```
   Connect to the MCP server at http://localhost:3000
   Set the cluster to devnet
   Import my wallet from ~/.config/solana/dev-wallet.json
   ```

3. **Create and manage a DAO**:

   ```
   Create a new DAO called "Test DAO" with me as the only member and threshold of 1
   Fund my DAO with 0.5 SOL
   ```

4. **Create and manage proposals**:
   ```
   Create a proposal to send 0.1 SOL to address abc123...
   Vote yes on the proposal
   Execute the proposal once it's approved
   ```

### Demo

<!-- Insert Twitter post or video demo here -->
<div align="center">
  <h4>Watch the daoCLI in action with MCP-powered natural language commands</h4>
  
  <!-- Replace the placeholder below with your actual Twitter embed or video link -->
  <a href="https://drive.google.com/file/your-demo-video-id/view">
    <img src="./docs/images/demo-thumbnail.png" alt="daoCLI Demo Video" width="600"/>
  </a>
</div>

---

## 🏗️ Project Structure

```
daoCLI-init/
├── src/
│   ├── commands/         # CLI command implementations
│   ├── mcp/              # MCP tools and resources
│   ├── services/         # Core business logic
│   ├── utils/            # Utility functions
│   ├── types/            # TypeScript type definitions
│   ├── debug/            # Debug scripts for testing
│   ├── mcp-server.ts     # MCP server implementation
│   └── index.ts          # Entry point
├── tests/                # Test files
├── dist/                 # Compiled output
└── docs/                 # Documentation
```

## 🧩 Architecture

The application integrates multiple key components:

1. **SPL Governance**: For DAO creation, proposal management, and voting
2. **Squads Multisig**: For multi-signature transaction approval
3. **[Model Context Protocol (MCP)](https://modelcontextprotocol.github.io/)**: For AI-assisted interactions and operations

For integrated DAOs, the tool creates a governance structure where proposals can control a multisig vault, enabling more complex treasury management with the security of multisig approvals.

The MCP integration provides:

- Natural language processing for intuitive interactions
- Documentation and help resources
- AI-assisted operation suggestions

## 🛠️ Development

To set up a development environment:

```bash
# Clone the repository
git clone https://github.com/DaoCLI/daoCLI-init.git
cd daoCLI-init

# Install dependencies
yarn install

# Run CLI in development mode
yarn dev

# Run MCP server in development mode
yarn dev:mcp

# Build the project
yarn build
```

## 🔍 Troubleshooting

- **Insufficient funds errors**: Ensure your wallet has enough SOL
- **Transaction errors**: Verify that you're using correct account addresses
- **"Account not found" errors**: The blockchain might be congested; try again
- **Proposal execution failures**: Make sure the proposal has been approved
- **MCP connection issues**: Verify the MCP server is running and accessible
- **Natural language parsing errors**: Try using more specific language or make your request more explicit

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
- [Model Context Protocol](https://modelcontextprotocol.github.io/)

---

Built with ❤️ for the Solana ecosystem
