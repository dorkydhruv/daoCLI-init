import { Command } from "commander";
import chalk from "chalk";
import { ConnectionService } from "../services/connection-service";
import { WalletService } from "../services/wallet-service";
import { ConfigService } from "../services/config-service";
import {
  PublicKey,
  LAMPORTS_PER_SOL,
  TransactionInstruction,
} from "@solana/web3.js";
import { ProposalService } from "../services/proposal-service";
import { SplGovernance } from "governance-idl-sdk";
import { SPL_GOVERNANCE_PROGRAM_ID } from "../utils/constants";
import * as multisig from "@sqds/multisig";
import { MultisigService } from "../services/multisig-service";
export function registerProposalCommands(program: Command): void {
  const proposalCommand = program
    .command("proposal")
    .description(
      "Proposal management for both DAO governance and multisig operations"
    )
    .addHelpText(
      "after",
      `
Integrated Workflow:
  1. Create a proposal (transfer-sol, transfer-token, or multisig-transfer)
  2. Vote on the proposal (automatically approves related multisig transaction)
  3. Execute the proposal (automatically executes related multisig transaction if threshold is met)

Examples:
  $ dao init --name "My DAO" --threshold 2 --members "pub1,pub2,pub3"
  $ proposal fund --target multisig --amount 0.2
  $ proposal multisig-transfer --amount 0.05 --recipient <ADDRESS>
  $ proposal vote --proposal <ADDRESS>
  $ proposal execute --proposal <ADDRESS>
`
    );

  proposalCommand
    .command("transfer-sol")
    .description("Create a proposal to transfer SOL from the DAO treasury")
    .option("-n, --name <string>", "Name of the proposal", "SOL Transfer")
    .option(
      "-d, --description <string>",
      "Description of the proposal",
      "Transfer SOL from DAO treasury"
    )
    .option("-a, --amount <number>", "Amount of SOL to transfer", "0.1")
    .option("-r, --recipient <string>", "Recipient wallet address")
    .action(async (options) => {
      try {
        // Load wallet and connection
        const wallet = await WalletService.loadWallet();
        if (!wallet) {
          console.log(
            chalk.red("No wallet configured. Please create a wallet first.")
          );
          return;
        }

        // Check config
        const config = await ConfigService.getConfig();
        if (!config.dao?.activeRealm) {
          console.log(
            chalk.yellow('No DAO configured. Use "dao init" to create one.')
          );
          return;
        }

        const connection = await ConnectionService.getConnection();
        const keypair = WalletService.getKeypair(wallet);
        const realmAddress = new PublicKey(config.dao.activeRealm);

        // Parse recipient
        let recipientAddress: PublicKey;
        if (options.recipient) {
          try {
            recipientAddress = new PublicKey(options.recipient);
          } catch (e) {
            console.log(chalk.red("Invalid recipient address."));
            return;
          }
        } else {
          // Use own address if no recipient provided
          recipientAddress = keypair.publicKey;
          console.log(
            chalk.yellow(
              `No recipient specified. Using your address: ${recipientAddress.toBase58()}`
            )
          );
        }

        // Parse amount
        const amount = parseFloat(options.amount);
        if (isNaN(amount) || amount <= 0) {
          console.log(
            chalk.red("Invalid amount. Please provide a positive number.")
          );
          return;
        }

        // Check if treasury is funded
        const splGovernance = new SplGovernance(
          connection,
          new PublicKey(SPL_GOVERNANCE_PROGRAM_ID)
        );
        const governanceId = splGovernance.pda.governanceAccount({
          realmAccount: realmAddress,
          seed: realmAddress,
        }).publicKey;
        const treasuryAddress = splGovernance.pda.nativeTreasuryAccount({
          governanceAccount: governanceId,
        }).publicKey;

        const treasuryBalance = await connection.getBalance(treasuryAddress);
        console.log(
          `Treasury balance: ${treasuryBalance / LAMPORTS_PER_SOL} SOL`
        );

        if (treasuryBalance < amount * LAMPORTS_PER_SOL) {
          console.log(
            chalk.yellow(
              `\n⚠️ Warning: Treasury doesn't have enough SOL to execute this transfer.`
            )
          );
          console.log(
            chalk.yellow(
              `Treasury balance: ${
                treasuryBalance / LAMPORTS_PER_SOL
              } SOL, transfer amount: ${amount} SOL`
            )
          );
          console.log(
            chalk.yellow(
              `Use 'proposal fund --target treasury' to fund the treasury first.`
            )
          );
          throw new Error(
            "Treasury doesn't have enough SOL to execute this transfer."
          );
        }

        console.log(chalk.blue("\nCreating SOL transfer proposal:"));
        console.log(`Name: ${options.name}`);
        console.log(`Description: ${options.description}`);
        console.log(`Amount: ${amount} SOL`);
        console.log(`Recipient: ${recipientAddress.toBase58()}`);

        // Create transfer instruction
        const transferInstruction =
          await ProposalService.getSolTransferInstruction(
            connection,
            realmAddress,
            amount,
            recipientAddress
          );

        // Create proposal
        console.log(chalk.blue("\nSubmitting proposal..."));
        const proposalAddress = await ProposalService.createProposal(
          connection,
          keypair,
          realmAddress,
          options.name,
          options.description,
          [transferInstruction]
        );

        console.log(chalk.green(`\n✅ Proposal created successfully!`));
        console.log(
          chalk.green(`Proposal address: ${proposalAddress.toBase58()}`)
        );
        console.log(chalk.blue("\nNext steps:"));
        console.log("1. Have members vote on the proposal");
        console.log(
          "2. After the voting period, execute the proposal if approved"
        );
      } catch (error) {
        console.error(chalk.red("Failed to create proposal:"), error);
      }
    });

  proposalCommand
    .command("transfer-token")
    .description(
      "Create a proposal to transfer SPL tokens from the DAO treasury"
    )
    .option("-n, --name <string>", "Name of the proposal", "Token Transfer")
    .option(
      "-d, --description <string>",
      "Description of the proposal",
      "Transfer tokens from DAO treasury"
    )
    .option("-a, --amount <number>", "Amount of tokens to transfer", "1")
    .option("-m, --mint <string>", "Token mint address")
    .option("-r, --recipient <string>", "Recipient wallet address")
    .action(async (options) => {
      try {
        // Load wallet and connection
        const wallet = await WalletService.loadWallet();
        if (!wallet) {
          console.log(
            chalk.red("No wallet configured. Please create a wallet first.")
          );
          return;
        }

        // Check config
        const config = await ConfigService.getConfig();
        if (!config.dao?.activeRealm) {
          console.log(
            chalk.yellow('No DAO configured. Use "dao init" to create one.')
          );
          return;
        }

        // Check mint
        if (!options.mint) {
          console.log(chalk.red("Token mint address is required."));
          return;
        }

        const connection = await ConnectionService.getConnection();
        const keypair = WalletService.getKeypair(wallet);
        const realmAddress = new PublicKey(config.dao.activeRealm);

        // Parse recipient
        let recipientAddress: PublicKey;
        if (options.recipient) {
          try {
            recipientAddress = new PublicKey(options.recipient);
          } catch (e) {
            console.log(chalk.red("Invalid recipient address."));
            return;
          }
        } else {
          // Use own address if no recipient provided
          recipientAddress = keypair.publicKey;
          console.log(
            chalk.yellow(
              `No recipient specified. Using your address: ${recipientAddress.toBase58()}`
            )
          );
        }

        // Parse token mint
        let tokenMint: PublicKey;
        try {
          tokenMint = new PublicKey(options.mint);
        } catch (e) {
          console.log(chalk.red("Invalid token mint address."));
          return;
        }

        // Parse amount
        const amount = parseFloat(options.amount);
        if (isNaN(amount) || amount <= 0) {
          console.log(
            chalk.red("Invalid amount. Please provide a positive number.")
          );
          return;
        }

        console.log(chalk.blue("\nCreating token transfer proposal:"));
        console.log(`Name: ${options.name}`);
        console.log(`Description: ${options.description}`);
        console.log(`Token mint: ${tokenMint.toBase58()}`);
        console.log(`Amount: ${amount} tokens`);
        console.log(`Recipient: ${recipientAddress.toBase58()}`);

        // Create transfer instructions
        const transferInstructions =
          await ProposalService.getTokenTransferInstruction(
            connection,
            realmAddress,
            tokenMint,
            amount,
            recipientAddress
          );

        // Create proposal
        console.log(chalk.blue("\nSubmitting proposal..."));
        const proposalAddress = await ProposalService.createProposal(
          connection,
          keypair,
          realmAddress,
          options.name,
          options.description,
          transferInstructions
        );

        console.log(chalk.green(`\n✅ Proposal created successfully!`));
        console.log(
          chalk.green(`Proposal address: ${proposalAddress.toBase58()}`)
        );
        console.log(chalk.blue("\nNext steps:"));
        console.log("1. Have members vote on the proposal");
        console.log(
          "2. After the voting period, execute the proposal if approved"
        );
      } catch (error) {
        console.error(chalk.red("Failed to create proposal:"), error);
      }
    });

  // Add vote command for proposals
  proposalCommand
    .command("vote")
    .description("Vote on an existing proposal")
    .option("-p, --proposal <string>", "Proposal address to vote on")
    .option("-a, --approve", "Vote to approve the proposal", true)
    .option("-d, --deny", "Vote to deny the proposal")
    .action(async (options) => {
      try {
        // Load wallet and connection
        const wallet = await WalletService.loadWallet();
        if (!wallet) {
          console.log(
            chalk.red("No wallet configured. Please create a wallet first.")
          );
          return;
        }

        // Check config
        const config = await ConfigService.getConfig();
        if (!config.dao?.activeRealm) {
          console.log(
            chalk.yellow('No DAO configured. Use "dao init" to create one.')
          );
          return;
        }

        if (!options.proposal) {
          console.log(chalk.red("Proposal address is required."));
          return;
        }

        const connection = await ConnectionService.getConnection();
        const keypair = WalletService.getKeypair(wallet);
        const realmAddress = new PublicKey(config.dao.activeRealm);

        // Parse proposal address
        let proposalAddress: PublicKey;
        try {
          proposalAddress = new PublicKey(options.proposal);
        } catch (e) {
          console.log(chalk.red("Invalid proposal address."));
          return;
        }

        // Determine vote (approve or deny)
        const approve = !options.deny;

        console.log(
          chalk.blue(`Casting vote to ${approve ? "approve" : "deny"} proposal`)
        );
        console.log(`Proposal: ${proposalAddress.toBase58()}`);

        // Cast vote
        await ProposalService.castVote(
          connection,
          keypair,
          realmAddress,
          proposalAddress,
          approve
        );

        console.log(chalk.green(`\n✅ Vote cast successfully!`));
      } catch (error) {
        console.error(chalk.red("Failed to vote on proposal:"), error);
      }
    });

  // Add execute command for proposals
  proposalCommand
    .command("execute")
    .description("Execute an approved proposal")
    .option("-p, --proposal <string>", "Proposal address to execute")
    .action(async (options) => {
      try {
        // Load wallet and connection
        const wallet = await WalletService.loadWallet();
        if (!wallet) {
          console.log(
            chalk.red("No wallet configured. Please create a wallet first.")
          );
          return;
        }

        // Check config
        const config = await ConfigService.getConfig();
        if (!config.dao?.activeRealm) {
          console.log(
            chalk.yellow('No DAO configured. Use "dao init" to create one.')
          );
          return;
        }

        if (!options.proposal) {
          console.log(chalk.red("Proposal address is required."));
          return;
        }

        const connection = await ConnectionService.getConnection();
        const keypair = WalletService.getKeypair(wallet);

        // Parse proposal address
        let proposalAddress: PublicKey;
        try {
          proposalAddress = new PublicKey(options.proposal);
        } catch (e) {
          console.log(chalk.red("Invalid proposal address."));
          return;
        }

        console.log(
          chalk.blue(`Executing proposal: ${proposalAddress.toBase58()}`)
        );

        // Execute the proposal
        await ProposalService.executeProposal(
          connection,
          keypair,
          proposalAddress
        );

        console.log(chalk.green(`\n✅ Proposal executed successfully!`));
      } catch (error) {
        console.error(chalk.red("Failed to execute proposal:"), error);
      }
    });

  // Add multisig-transfer command for transferring from Squads multisig
  proposalCommand
    .command("multisig-transfer")
    .description(
      "Create a unified proposal that transfers assets from the multisig vault and automatically synchronizes voting between the DAO and multisig"
    )
    .option("-n, --name <string>", "Name of the proposal", "Multisig Transfer")
    .option(
      "-d, --description <string>",
      "Description of the proposal",
      "Transfer assets from Squads multisig"
    )
    .option("-a, --amount <number>", "Amount of SOL to transfer", "0.1")
    .option("-m, --mint <string>", "Token mint address (for token transfers)")
    .option("-r, --recipient <string>", "Recipient wallet address")
    .action(async (options) => {
      try {
        // Load wallet and connection
        const wallet = await WalletService.loadWallet();
        if (!wallet) {
          console.log(
            chalk.red("No wallet configured. Please create a wallet first.")
          );
          return;
        }

        // Check config
        const config = await ConfigService.getConfig();
        if (!config.dao?.activeRealm || !config.dao?.activeMultisig) {
          console.log(
            chalk.yellow(
              'No integrated DAO configured. Use "dao init --integrated" to create one.'
            )
          );
          return;
        }

        const connection = await ConnectionService.getConnection();
        const keypair = WalletService.getKeypair(wallet);
        const realmAddress = new PublicKey(config.dao.activeRealm);

        // Find the multisig associated with this realm
        const multisigAddress =
          MultisigService.getMultisigForRealm(realmAddress);

        // Parse recipient
        let recipientAddress: PublicKey;
        if (options.recipient) {
          try {
            recipientAddress = new PublicKey(options.recipient);
          } catch (e) {
            console.log(chalk.red("Invalid recipient address."));
            return;
          }
        } else {
          // Use own address if no recipient provided
          recipientAddress = keypair.publicKey;
          console.log(
            chalk.yellow(
              `No recipient specified. Using your address: ${recipientAddress.toBase58()}`
            )
          );
        }

        // Parse amount
        const amount = parseFloat(options.amount);
        if (isNaN(amount) || amount <= 0) {
          console.log(
            chalk.red("Invalid amount. Please provide a positive number.")
          );
          return;
        }

        // Check multisig vault balance
        const [vaultPda] = multisig.getVaultPda({
          multisigPda: multisigAddress,
          index: 0,
        });
        const vaultBalance = await connection.getBalance(vaultPda);

        if (vaultBalance < amount * LAMPORTS_PER_SOL) {
          console.log(
            chalk.yellow(
              `\n⚠️ Warning: Vault doesn't have enough SOL to execute this transfer.`
            )
          );
          console.log(
            chalk.yellow(
              `Vault balance: ${
                vaultBalance / LAMPORTS_PER_SOL
              } SOL, transfer amount: ${amount} SOL`
            )
          );
          console.log(
            chalk.yellow(
              `Use 'proposal fund --target multisig' to fund the vault first.`
            )
          );

          // Prompt to continue
          const readline = require("readline").createInterface({
            input: process.stdin,
            output: process.stdout,
          });

          const response = await new Promise((resolve) => {
            readline.question(
              "Continue creating the proposal anyway? (y/n): ",
              (answer: string) => {
                readline.close();
                resolve(answer.toLowerCase());
              }
            );
          });

          if (response !== "y" && response !== "yes") {
            console.log("Operation canceled.");
            return;
          }
        }

        console.log(chalk.blue("\nCreating transfer proposal:"));
        console.log(`Name: ${options.name}`);
        console.log(`Description: ${options.description}`);
        console.log(`Amount: ${amount} SOL`);
        console.log(`Recipient: ${recipientAddress.toBase58()}`);

        // Create transfer instructions
        let instructions: TransactionInstruction[];

        if (options.mint) {
          // Token transfer
          const tokenMint = new PublicKey(options.mint);
          console.log(`Token mint: ${tokenMint.toBase58()}`);

          instructions =
            await ProposalService.getSquadsMultisigTokenTransferInstruction(
              connection,
              multisigAddress,
              tokenMint,
              amount,
              recipientAddress
            );
        } else {
          // SOL transfer
          instructions = [
            await ProposalService.getSquadsMultisigSolTransferInstruction(
              connection,
              multisigAddress,
              amount,
              recipientAddress
            ),
          ];
        }

        // Create integrated proposal
        console.log(chalk.blue("\nSubmitting integrated proposal..."));
        const proposalAddress =
          await ProposalService.createIntegratedAssetTransferProposal(
            connection,
            keypair,
            realmAddress,
            options.name,
            options.description,
            instructions
          );

        console.log(
          chalk.green(`\n✅ Integrated proposal created successfully!`)
        );
        console.log(
          chalk.green(`Proposal address: ${proposalAddress.toBase58()}`)
        );
        console.log(chalk.blue("\nNext steps:"));
        console.log("1. Vote on the proposal with:");
        console.log(
          `   proposal vote --proposal ${proposalAddress.toBase58()}`
        );
        console.log("2. After approval, execute the proposal with:");
        console.log(
          `   proposal execute --proposal ${proposalAddress.toBase58()}`
        );
        console.log(
          "\nNote: The multisig transaction will be created when the DAO proposal executes"
        );
        console.log(
          "      and will be automatically approved and executed when threshold is met."
        );
      } catch (error) {
        console.error(chalk.red("Failed to create proposal:"), error);
      }
    });
}
