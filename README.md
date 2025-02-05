# daoCLI - the value of AI Agents is only made possible by DAOs

## Multi-Chain Programmatic & Embedded DAOs for AI Agents and Developers
### It's like Terraform...but for DAOs!!!

daoCLI is a toolkit built for AI agents to create and manage programmatic & embedded DAOs across multiple blockchains. Currently supporting Solana and StarkNet, daoCLI provides a unified interface for cross-chain DAO operations. Traditional DAOs require human interfaces, separate websites, and manual governance – making them unsuitable for AI-driven operations. daoCLI solves this by providing a CLI-first, programmatic approach that enables AI agents to create, manage, and interact with DAOs directly through code.

**We are like Stripe...we are developer first. Because AI Agents are developer first.**

## OpenAI & Sam Altman thinks exactly like us
Don't believe me? This is what OpenAI focuses on.
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
- **Unified API**: Consistent interface across chains.
- **Chain Abstraction**: Chain-agnostic operations.
- **Cross-chain Management**: Manage DAOs across Solana and StarkNet.
- **Chain-specific Optimizations**: Leverage each chain's strengths.

### Programmatic Control
- **API-First Design**: Every feature accessible through code.
- **Event-Driven Architecture**: React to cross-chain events.
- **Automated Decision Making**: Chain-agnostic governance.
- **Batch Operations**: Handle multiple DAOs efficiently.

### AI Integration Features
- **Cross-chain Analytics**: Unified view across chains.
- **Chain Selection Logic**: AI-driven chain selection.
- **Multi-chain State Management**: Track DAO state across chains.
- **Cross-chain Event Subscriptions**: Real-time updates.

## 🚀 Quick Start

---

## Table of Contents

1. [Overview](#overview)
2. [Project Structure](#project-structure)
3. [Prerequisites](#prerequisites)
4. [Setup](#setup)
5. [Building & Compiling](#building--compiling)
    - [CLI Tool (TypeScript)](#cli-tool-typescript)
    - [Solana Smart Contract (Anchor/Rust)](#solana-smart-contract-anchorrust)
    - [StarkNet Smart Contract (Cairo)](#starknet-smart-contract-cairo)
6. [Running the Application](#running-the-application)
    - [Using the CLI](#using-the-cli)
    - [Running Tests](#running-tests)
7. [Deployment & Integration](#deployment--integration)
8. [Additional Information](#additional-information)
9. [License](#license)

---

## Overview

daoCLI provides a unified interface to:
- **Initialize DAOs** on Solana and StarkNet.
- **Create liquidity pools** and manage token interactions.
- **Automate governance operations** without manual intervention.
- **Support AI agents** by enabling programmatic, event-driven operations across chains.

---

## Project Structure

The repository is organized as follows:

```
daoCLI/
├── daocli-philosophy.md         # daoCLI philosophy and whitepaper
├── dao_config.json              # Unified configuration for Solana and StarkNet
├── LICENSE                      # License file
├── dao-detailed-system.mermaid  # Detailed system diagram
├── README.md                    # This README file
├── whitepaper-v1.md             # Whitepaper version 1
├── dao_contract.cairo           # StarkNet smart contract (Cairo)
├── CLA.md                       # Contributor License Agreement
├── dao_contract.rs              # Solana smart contract (Anchor/Rust)
├── cli.ts                       # CLI tool (TypeScript) for DAO operations
├── known-issues.md              # Known issues and fixes
└── tests.ts                     # Automated tests for CLI functionality
```

---

## Prerequisites

Before building and running daoCLI, ensure you have installed:

- **Node.js** (v14 or later) and **npm**
- **TypeScript** and **ts-node** (for running the CLI)
- **Anchor CLI** and the **Rust toolchain** (for building Solana smart contracts)
- **Solana CLI** (for deploying to the Solana network)
- **StarkNet CLI** (for compiling and deploying Cairo contracts)
- **Mocha** and **Chai** (for running tests)

---

## Setup

1. **Clone the Repository**

   ```bash
   git clone https://github.com/yourusername/daoCLI.git
   cd daoCLI
   ```

2. **Install Node Dependencies**

   ```bash
   npm install
   ```

3. **Ensure Anchor & Rust Are Installed**

   - Follow the [Anchor installation guide](https://project-serum.github.io/anchor/getting-started/installation.html).
   - Ensure you have the Rust toolchain installed (`rustup`).

4. **Install StarkNet CLI**

   Follow the [StarkNet CLI installation instructions](https://www.cairo-lang.org/docs/quickstart.html).

---

## Building & Compiling

### CLI Tool (TypeScript)

- **Compilation (Optional):**

  If you prefer compiling the TypeScript code, run:

  ```bash
  tsc cli.ts
  ```

  Alternatively, run directly with:

  ```bash
  ts-node cli.ts <command> [options]
  ```

- The CLI now supports additional subcommands:
  - **`init`**: Initialize a new DAO.
  - **`create-pool`**: Create a liquidity pool.
  - **`deploy`**: Deploy DAO smart contracts.
  - **`upgrade`**: Upgrade an existing DAO contract version.

### Solana Smart Contract (Anchor/Rust)

1. **Build the Contract:**

   Navigate to the directory containing `dao_contract.rs` and run:

   ```bash
   anchor build
   ```

   This compiles the Solana program and outputs the binaries and IDL in the `target/` folder.

2. **Deploy the Contract:**

   Configure your Solana wallet and network via the Solana CLI and Anchor configuration, then deploy using:

   ```bash
   anchor deploy
   ```

3. **Upgrade Support:**

   The contract now includes a version field and an `upgrade` instruction (callable only by the manager) for seamless migrations.

### StarkNet Smart Contract (Cairo)

1. **Compile the Contract:**

   Use the StarkNet CLI to compile the Cairo contract:

   ```bash
   starknet-compile dao_contract.cairo --output dao_contract_compiled.json --abi dao_contract_abi.json
   ```

2. **Deploy the Contract:**

   Deploy the contract using:

   ```bash
   starknet deploy --contract dao_contract_compiled.json --account YOUR_ACCOUNT_ADDRESS
   ```

3. **Upgrade Support:**

   The Cairo contract now includes a `version` storage variable (initialized to 1) and an external `upgrade` function.

---

## Running the Application

### Using the CLI

The CLI tool supports these primary commands:

- **Initialize a DAO:**

  ```bash
  ts-node cli.ts init -t 1000 -d 7 -m 0.1 -c solana
  ```

  or

  ```bash
  ts-node cli.ts init -t 1000 -d 7 -m 0.1 -c starknet
  ```

- **Create a Liquidity Pool:**

  ```bash
  ts-node cli.ts create-pool -n 50 -t 1000000 -c solana
  ```

  or

  ```bash
  ts-node cli.ts create-pool -n 50 -t 1000000 -c starknet
  ```

- **Deploy DAO Smart Contracts:**

  ```bash
  ts-node cli.ts deploy -c solana
  ```

  or

  ```bash
  ts-node cli.ts deploy -c starknet
  ```

- **Upgrade an Existing DAO:**

  ```bash
  ts-node cli.ts upgrade -v 2 -c solana
  ```

  or

  ```bash
  ts-node cli.ts upgrade -v 2 -c starknet
  ```

Each command prints a dummy transaction hash to simulate the process. Replace the dummy implementations with real calls (using Anchor CLI, StarkNet CLI, etc.) when integrating into production.

### Running Tests

Automated tests use Mocha and Chai. To run tests:

1. **Install Mocha & Chai:**

   ```bash
   npm install --save-dev mocha chai ts-node
   ```

2. **Run the Tests:**

   ```bash
   npx mocha -r ts-node/register tests.ts
   ```

---

## Deployment & Integration

### Solana Deployment

- **Contract Deployment:**
  - Use `anchor build` and `anchor deploy` to compile and deploy your Solana contracts.
  - Update `dao_config.json` with the deployed program ID.

- **Integration:**
  - Interact with the deployed contracts via the CLI tool.
  - Utilize solana-web3.js and Anchor’s IDL for programmatic interactions.

### StarkNet Deployment

- **Contract Deployment:**
  - Use `starknet-compile` and `starknet deploy` for the Cairo contracts.
  - Update `dao_config.json` with the deployed contract address.

- **Integration:**
  - The CLI interacts with StarkNet contracts using the provided configuration.
  - Use starknet.js or similar libraries for further interactions.

---

## Additional Information

- **Configuration:**  
  The `dao_config.json` file holds configuration settings for both Solana and StarkNet (RPC URLs, contract addresses, fee settings). Adjust these values as needed.

- **Modularity:**  
  The system is built with a modular architecture. You can enable or disable modules (token, liquidity, governance, treasury, upgrade) via configuration or CLI flags.

- **Upgrade Path:**  
  Deployed contracts include a version field and support upgrade instructions. Use the CLI `upgrade` command to migrate to new contract versions.

- **Embeddability:**  
  DAO contracts are designed to be callable from web apps or other integrations, with a unified API across chains.

- **Further Documentation:**  
  For more details on usage, refer to the included whitepaper and technical documentation files (e.g., `daocli-philosophy.md`, `dao-detailed-system.mermaid`).

---

## License

This project is licensed under the GNU Affero General Public License version 3 (AGPL-3.0) with a CLA. See the [LICENSE](./LICENSE) file for details.
```

