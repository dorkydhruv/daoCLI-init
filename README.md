# daoCLI - the value of AI Agents is only made possible by DAOs

## Multi-Chain Programmatic & Embedded DAOs for AI Agents and Developers
### It's like Terraform...but for DAOs!!!

daoCLI is a toolkit built for AI agents to create and manage programmatic & embedded DAOs across multiple blockchains. Currently supporting Solana and StarkNet, daoCLI provides a unified interface for cross-chain DAO operations. Traditional DAOs require human interfaces, separate websites, and manual governance - making them unsuitable for AI-driven operations. daoCLI solves this by providing a CLI-first, programmatic approach that enables AI agents to create, manage, and interact with DAOs directly through code.

**We are like Stripe...we are developer first. Because AI Agents are developer first**.

## OpenAI & Sam Altman thinks exactly like us
Don't believe me ? This is what OpenAI focuses on.
* [https://openai.com/index/practices-for-governing-agentic-ai-systems/](https://openai.com/index/practices-for-governing-agentic-ai-systems/)
* [https://openai.com/index/governance-of-superintelligence/](https://openai.com/index/governance-of-superintelligence/)


## DAO is everything - not the token

<div align="center">
  <table>
    <tr>
      <td align="center" width="50%">
        <a href="https://github.com/user-attachments/assets/f0ca054a-12b9-407e-a1bb-b36a30361695">
          <img src="https://github.com/user-attachments/assets/f0ca054a-12b9-407e-a1bb-b36a30361695" 
               width="100%" 
               alt="DAO image 1"
               style="transition: transform 0.2s; display: inline-block;"
               onmouseover="this.style.transform='scale(1.05)'"
               onmouseout="this.style.transform='scale(1)'"/>
        </a>
      </td>
      <td align="center" width="50%">
        <a href="https://github.com/user-attachments/assets/fb63863a-05bb-4bfb-811e-89d37fe8e7b0">
          <img src="https://github.com/user-attachments/assets/fb63863a-05bb-4bfb-811e-89d37fe8e7b0" 
               width="100%" 
               alt="DAO image 2"
               style="transition: transform 0.2s; display: inline-block;"
               onmouseover="this.style.transform='scale(1.05)'"
               onmouseout="this.style.transform='scale(1)'"/>
        </a>
      </td>
    </tr>
    <tr>
      <td align="center">
        <a href="https://github.com/user-attachments/assets/20e724ca-c0d4-48c8-b8d2-a6c359d87cde">
          <img src="https://github.com/user-attachments/assets/20e724ca-c0d4-48c8-b8d2-a6c359d87cde" 
               width="100%" 
               alt="DAO image 3"
               style="transition: transform 0.2s; display: inline-block;"
               onmouseover="this.style.transform='scale(1.05)'"
               onmouseout="this.style.transform='scale(1)'"/>
        </a>
      </td>
      <td align="center">
        <a href="https://github.com/user-attachments/assets/ca674171-b71c-4374-ac99-9e3e9fbd699f">
          <img src="https://github.com/user-attachments/assets/ca674171-b71c-4374-ac99-9e3e9fbd699f" 
               width="100%" 
               alt="DAO image 4"
               style="transition: transform 0.2s; display: inline-block;"
               onmouseover="this.style.transform='scale(1.05)'"
               onmouseout="this.style.transform='scale(1)'"/>
        </a>
      </td>
    </tr>
    <tr>
      <td align="center" colspan="2">
        <a href="https://github.com/user-attachments/assets/d9527473-39c0-49c7-adfc-b19199c806b3">
          <img src="https://github.com/user-attachments/assets/d9527473-39c0-49c7-adfc-b19199c806b3" 
               width="50%" 
               alt="DAO image 5"
               style="transition: transform 0.2s; display: inline-block;"
               onmouseover="this.style.transform='scale(1.05)'"
               onmouseout="this.style.transform='scale(1)'"/>
        </a>
      </td>
    </tr>
  </table>
</div>

## Why daoCLI?
For Developers | For Users | For Investors
---------------|-----------|---------------
Multi-chain support from day one | Chain-agnostic interface | Cross-chain exposure
CLI-first approach | Stay in your product ecosystem | Multi-chain liquidity
Full automation support | Seamless token interactions | Real-time price discovery
Git & CI/CD integration | Integrated trading interface | Transparent mechanics
Chain-specific optimizations | No platform switching | Cross-chain arbitrage

## 🤖 Why AI Agents Need daoCLI

Traditional DAOs | daoCLI for AI
----------------|---------------
Single-chain limitation | Multi-chain orchestration
Requires human interfaces | Pure programmatic interaction
Manual governance through websites | Automated cross-chain governance
Separate platforms & websites | Embedded directly in applications
High operational overhead | Minimal computational overhead
Chain-specific implementations | Unified API across chains



## 🎯 Core Features for AI Agents

### Multi-Chain Support
- **Unified API**: Consistent interface across chains
- **Chain Abstraction**: Chain-agnostic operations
- **Cross-chain Management**: Manage DAOs across Solana and StarkNet
- **Chain-specific Optimizations**: Leverage each chain's strengths

### Programmatic Control
- **API-First Design**: Every feature accessible through code
- **Event-Driven Architecture**: React to cross-chain events
- **Automated Decision Making**: Chain-agnostic governance
- **Batch Operations**: Handle multiple DAOs efficiently

### AI Integration Features
- **Cross-chain Analytics**: Unified view across chains
- **Chain Selection Logic**: AI-driven chain selection
- **Multi-chain State Management**: Track DAO state across chains
- **Cross-chain Event Subscriptions**: Real-time updates

## 🚀 Quick Start


# daoCLI Project Readme

## Overview
daoCLI is a toolkit for AI agents and developers to create and manage multi-chain DAOs across Solana and StarkNet. This project provides:
- A CLI tool (written in TypeScript) that supports cross-chain DAO operations.
- A Solana smart contract built using Anchor (in Rust).
- A StarkNet smart contract written in Cairo.

The solution is kept minimal and optimized so that you can quickly build, compile, deploy, and run the entire system.

## Project Structure
```
daoCLI/
├── dao_config.json          // Unified configuration for both chains
├── cli.ts                   // CLI tool (TypeScript)
├── dao_contract.rs          // Solana smart contract (Anchor/Rust)
└── dao_contract.cairo       // StarkNet smart contract (Cairo)
```

## Prerequisites

### General
- **Git** – for version control.
- **Node.js (v14 or later) and npm/yarn** – for running the CLI tool.
- **TypeScript & ts-node** – for development and running the CLI.

### Solana/Anchor
- **Rust Toolchain** – install via [rustup](https://rustup.rs/).
- **Anchor CLI** – install with:
  ```
  cargo install --git https://github.com/project-serum/anchor anchor-cli --locked
  ```
- **Solana CLI** – install/update with:
  ```
  sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
  ```
  and configure your wallet using `solana config set --keypair <PATH_TO_KEYPAIR>`.

### StarkNet/Cairo
- **Cairo-lang Compiler** – follow the [Cairo Quickstart](https://www.cairo-lang.org/docs/quickstart.html) instructions.
- **StarkNet CLI** – install via pip:
  ```
  pip install starknet-devnet
  ```
  (Or use other deployment tools as preferred.)

## Installation

1. **Clone the repository:**
   ```
   git clone https://github.com/yourusername/daoCLI.git
   cd daoCLI
   ```

2. **Install Node.js dependencies:**
   ```
   npm install
   ```
   This installs packages such as `commander`, `ora`, `chalk`, `@solana/web3.js`, and `@project-serum/anchor`.

## Configuration

Edit the `dao_config.json` file to adjust parameters such as RPC URLs, program IDs, and fee settings for both chains.

Example `dao_config.json`:
```json
{
  "solana": {
    "rpcUrl": "https://api.mainnet-beta.solana.com",
    "programId": "dao11111111111111111111111111111111111111",
    "fees": {
      "tradingFee": 0.003,
      "stakingFee": 0.002,
      "managerFee": 0.08
    }
  },
  "starknet": {
    "providerUrl": "https://starknet-mainnet.infura.io/v3/YOUR-PROJECT-ID",
    "daoAddress": "0x123...abc",
    "fees": {
      "tradingFee": 0.003,
      "stakingFee": 0.002,
      "managerFee": 0.08
    }
  }
}
```

## Building and Deploying

### 1. Solana Smart Contract (Anchor)

#### Build
- From the project root directory, run:
  ```
  anchor build
  ```
  This command compiles the Solana program defined in `dao_contract.rs` and generates an IDL and binary artifacts.

#### Deploy
- Ensure your Solana CLI is configured with the correct keypair and network.
- Deploy the program using:
  ```
  anchor deploy
  ```
  The program ID should match the one specified in `dao_config.json`.

### 2. StarkNet Smart Contract (Cairo)

#### Compile
- Compile the Cairo contract with:
  ```
  starknet-compile dao_contract.cairo --output dao_contract_compiled.json --abi dao_contract_abi.json
  ```
  This produces the compiled contract and its ABI.

#### Deploy
- Deploy the compiled contract using the StarkNet CLI (adjust the network flag as needed):
  ```
  starknet deploy --contract dao_contract_compiled.json --network mainnet
  ```
  Note the deployed contract address and update `dao_config.json` if necessary.

### 3. CLI Tool

#### Running the CLI in Development
- Use `ts-node` to run the CLI directly:
  ```
  npx ts-node cli.ts --help
  ```
  This will display available commands and options.

#### Compiling the CLI
- To compile the CLI to JavaScript, run:
  ```
  tsc cli.ts
  ```
- Then run the generated file with Node.js:
  ```
  node cli.js --help
  ```

## Running the CLI Commands

The CLI supports commands for initializing a DAO and creating a liquidity pool on either Solana or StarkNet.

### Initialize a DAO

To initialize a new DAO:
```
npx ts-node cli.ts init -t 1000 -d 7 -m 0.1 -c solana
```
- `-t, --target` specifies the fundraising target.
- `-d, --duration` is the duration in days.
- `-m, --min-price` is the minimum pool price.
- `-c, --chain` selects the blockchain (`solana` or `starknet`).

### Create a Liquidity Pool

To create a liquidity pool:
```
npx ts-node cli.ts create-pool -n 50 -t 1000000 -c solana
```
- `-n, --native` specifies the amount in native tokens.
- `-t, --tokens` specifies the amount in DAO tokens.
- The `-c` option selects the target chain.

## Usage Notes

- **Wallets:** The provided minimal implementations use dummy wallet addresses. In a production environment, integrate real wallet connections.
- **Error Handling:** This project uses basic logging and dummy implementations. Extend error handling and transaction confirmations as needed.
- **Chain-Specific Logic:** The Solana client uses Anchor and the StarkNet client uses Cairo; adjust the business logic in the respective classes and contracts for full functionality.


## 💡 Technical Architecture

### Chain Support Matrix
Feature | Solana | StarkNet
--------|---------|----------
DAO Creation | ✅ | ✅
AMM Integration | Orca, Raydium | JediSwap
Staking | Native | Native
Governance | SPL-Gov | Cairo Native
Performance | High TPS | Layer 2 Scaling

### Integration Points
1. **Cross-chain Messaging**
   - Wormhole integration
   - State synchronization
   - Asset bridges

2. **Chain-specific Features**
   - Solana Program Deployment
   - StarkNet Contract Declaration
   - Chain-optimal execution

### Core Components
1. **AI Interface Layer**
   - Event subscriptions
   - State management
   - Decision execution
   - Performance monitoring

2. **Smart Contracts**
   - Programmatic governance
   - Automated treasury
   - Trading mechanics
   - Risk management

3. **API Layer**
   - RESTful endpoints
   - WebSocket feeds
   - State queries
   - Batch operations

## 📊 AI Trading Integration

### Automated Markets
- AI-driven liquidity provision
- Dynamic fee adjustment
- Risk-based position sizing
- Multi-pool optimization

### Performance Metrics
- Real-time price analysis
- Volume predictions
- Risk assessments
- Portfolio analytics

## 🛠 Implementation Example

### AI Agent Integration
```typescript
import { DaoManager } from '@daocli/ai'

async function setupAIManager() {
  const manager = new DaoManager({
    strategy: './ai_strategy.json',
    riskParams: './risk_config.json',
    autoRebalance: true
  })

  // Subscribe to events
  manager.on('priceChange', async (data) => {
    await manager.adjustStrategy(data)
  })

  // Execute trades
  await manager.executeTradingStrategy()
}
```

### Automated Governance
```typescript
import { Governance } from '@daocli/governance'

async function setupGovernance() {
  const governance = new Governance({
    aiAgent: YOUR_AI_AGENT,
    quorum: 100_000,
    executionDelay: 0 // Instant for AI
  })

  // Create and execute proposals
  await governance.createProposal({
    action: 'adjustFees',
    params: { newFee: 0.3 }
  })
}
```

## 🔒 Security

### AI-Specific Security
- Rate limiting
- Risk boundaries
- Emergency shutdown
- State validation

### Smart Contract Security
- Formal verification
- Automated testing
- Security bounties
- Regular audits


## 📈 For Investors

### Investment Benefits
- Direct exposure to DAO performance
- Liquid secondary market
- Real-time price discovery
- Transparent mechanics
- No lockup periods

### Trading Features
- Price charts and market depth
- Portfolio tracking
- Order history
- Performance analytics

## 🔒 Security

### Smart Contract Security
- Audited by leading firms
- Open-source contracts
- Bug bounty program
- Regular security updates

### Best Practices
- Multi-sig treasury
- Time-locked operations
- Slippage protection
- Emergency shutdown mechanisms


## 📋 Roadmap

### Phase 1 (Current)
- [x] Core DAO functionality
- [x] AMM implementation
- [x] Basic trading interface
- [x] CLI tools

### Phase 2 (Q2 2024)
- [ ] Advanced governance features
- [ ] Multi-chain support
- [ ] Enhanced analytics
- [ ] Mobile SDK

### Phase 3 (Q3 2024)
- [ ] AI integration
- [ ] Advanced trading features
- [ ] Cross-chain operations
- [ ] DAO templates

# daoCLI (DCLI) Token Economics
## Platform Token for the daoCLI Ecosystem

## Overview
DCLI is the native utility and governance token for the daoCLI platform, designed to align incentives between developers, AI agents, and DAO creators while ensuring sustainable platform growth.

## Token Details
- **Name**: daoCLI CLI Token
- **Symbol**: DCLI
- **Blockchain**: Solana
- **Token Standard**: SPL
- **Total Supply**: 1,000,000,000 (1 billion) DCLI
- **Decimal Places**: 9

## Token Distribution

### Initial Token Allocation
Total Supply: 1,000,000,000 DCLI

| Category | Allocation | Tokens | Vesting |
|----------|------------|---------|---------|
| Platform Development | 20% | 200M | 4-year linear vesting, 1-year cliff |
| Ecosystem Growth | 25% | 250M | 5-year linear release |
| Community Treasury | 20% | 200M | Community-controlled |
| Initial Liquidity | 5% | 50M | Locked in AMM pools |
| Team & Advisors | 15% | 150M | 3-year linear vesting, 1-year cliff |
| Early Investors | 10% | 100M | 2-year linear vesting, 6-month cliff |
| Public Sale | 5% | 50M | Immediate circulation |

### Vesting Schedule Details

#### Platform Development (20%)
- 1-year cliff
- 4-year linear vesting
- Quarterly unlocks after cliff
- Used for core platform development, security audits, and infrastructure

#### Ecosystem Growth (25%)
- 5-year linear release
- Monthly unlocks
- Allocation breakdown:
  - Developer Incentives: 40%
  - AI Agent Integration Grants: 30%
  - Hackathons & Bounties: 20%
  - Educational Content: 10%

#### Community Treasury (20%)
- Controlled by DAO governance
- Initial unlock: 10%
- Remaining 90% unlocked over 3 years
- Used for:
  - Protocol improvements
  - Community initiatives
  - Grants
  - Bug bounties

#### Initial Liquidity (5%)
- Permanently locked in AMM pools
- Distribution:
  - Orca: 40%
  - Raydium: 40%
  - Jupiter: 20%

#### Team & Advisors (15%)
- 1-year cliff
- 3-year linear vesting
- Monthly unlocks after cliff
- Smart contract enforced vesting

#### Early Investors (10%)
- 6-month cliff
- 2-year linear vesting
- Monthly unlocks after cliff

#### Public Sale (5%)
- Immediate circulation
- Fair launch auction mechanism
- Price discovery through Orca Whirlpools

## Token Utility

### 1. Platform Access
- DCLI staking required for:
  - Premium features access
  - Advanced analytics
  - Priority support
  - Custom deployment options

### 2. Fee Structure
| Action | Fee (DCLI) | Distribution |
|--------|------------|--------------|
| DAO Creation | 1,000 DCLI | 70% burned, 30% treasury |
| Template Usage | 100 DCLI | 50% template creator, 50% treasury |
| Premium Features | 500 DCLI/month | 80% burned, 20% treasury |
| Custom Domain | 200 DCLI/month | 100% burned |

### 3. Staking Tiers
| Tier | DCLI Required | Benefits |
|------|---------------|-----------|
| Basic | 1,000 | Access to basic templates |
| Pro | 5,000 | Custom branding, priority support |
| Enterprise | 25,000 | White-label solution, dedicated support |
| Network | 100,000 | Revenue sharing, governance weight 2x |

### 4. Governance
- Voting weight: 1 DCLI = 1 vote
- Proposal creation: 10,000 DCLI minimum stake
- Voting period: 5 days
- Quorum requirement: 10% of circulating supply
- Time-lock for major upgrades: 48 hours

## Deflationary Mechanisms

### 1. Fee Burning
- 70% of all platform fees burned
- Estimated quarterly burn rate: 0.5-1% of circulating supply
- Dynamic burning based on platform usage

### 2. Buy-Back Program
- 10% of platform revenue allocated to buy-back
- Automated execution through smart contracts
- Purchased tokens split:
  - 80% burned
  - 20% to community treasury

### 3. Staking Rewards
- Base APY: 5%
- Bonus APY for long-term staking:
  - 6 months: +2%
  - 1 year: +5%
  - 2 years: +8%
- Maximum combined APY: 15%

## Treasury Management

### Revenue Streams
1. Platform fees (30%)
2. Template marketplace fees (5%)
3. Premium subscriptions (40%)
4. Enterprise licenses (25%)

### Treasury Allocation
- Development: 40%
- Marketing & Growth: 20%
- Security: 15%
- Community Rewards: 15%
- Reserve: 10%

## Economic Sustainability

### Supply Control
- All platform fees paid in DCLI
- Regular token burns from fee collection
- Long-term staking incentives
- Governance-controlled inflation rate (max 2% annually)

### Demand Drivers
1. Required for platform usage
2. Staking rewards
3. Governance rights
4. Revenue sharing for high-tier stakers
5. Access to premium features

## Risk Mitigation

### Concentration Limits
- Maximum wallet holding: 5% of total supply
- Maximum voting power: 4% per address
- Minimum 14-day unstaking period

### Security Measures
- Multi-sig treasury management
- Time-locked governance actions
- Regular security audits
- Bug bounty program

## Ecosystem Development

### Developer Incentives
- Grant program: 50M DCLI allocated
- Hackathon prizes: 25M DCLI allocated
- Integration bounties: 25M DCLI allocated

### Partnership Allocations
- Strategic partners: 50M DCLI reserved
- Integration partners: 25M DCLI reserved
- Marketing initiatives: 25M DCLI reserved

## Future Considerations

### Governance Evolution
- Transition to full DAO governance over 2 years
- Introduction of delegated voting
- Specialized governance committees
- Cross-chain governance capabilities

### Technical Upgrades
- Cross-chain bridge support
- Layer 2 scaling solutions
- Advanced staking mechanisms
- Automated market makers optimization

## Success Metrics

### Key Performance Indicators
1. Monthly Active DAOs
2. Total Value Locked (TVL)
3. Daily Active Users
4. Token Velocity
5. Governance Participation Rate

### Growth Targets
Year 1:
- 1,000 DAOs created
- $100M TVL
- 50,000 active users

Year 3:
- 10,000 DAOs created
- $1B TVL
- 500,000 active users

---

Note: This tokenomics model is designed to be sustainable and value-accruing while prioritizing long-term platform growth and community involvement. All parameters are subject to adjustment through governance proposals.

---

Built with ❤️ by the daoCLI team
