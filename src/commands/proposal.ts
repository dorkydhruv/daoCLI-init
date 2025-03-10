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
import { GovernanceService } from "../services/governance-service";
import { ProposalV2 } from "governance-idl-sdk";

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
  1. Create a proposal (transfer)
  2. Vote on the proposal (automatically approves related multisig transaction)
  3. Execute the proposal (automatically executes related multisig transaction if threshold is met)

Examples:
  $ daocli dao init --name "My DAO" --threshold 2 --members "pub1,pub2,pub3"
  $ daocli dao fund --amount 0.2
  $ daocli proposal transfer --amount 0.05 --recipient <ADDRESS> --mint <MINT_ADDRESS>
  $ daocli proposal vote --proposal <ADDRESS>
  $ daocli proposal execute --proposal <ADDRESS>
`
    );

  proposalCommand
    .command("transfer")
    .description(
      "Create a proposal to transfer SOL (automatically handles treasury or multisig transfers)"
    )
    .option("-n, --name <string>", "Name of the proposal", "Asset Transfer")
    .option(
      "-d, --description <string>",
      "Description of the proposal",
      "Transfer assets from DAO"
    )
    .option("-a, --amount <number>", "Amount of SOL/tokens to transfer", "0.1")
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
        if (!config.dao?.activeRealm) {
          console.log(
            chalk.yellow(
              'No DAO configured. Use "dao use <ADDRESS>" to select one.'
            )
          );
          return;
        }

        const connection = await ConnectionService.getConnection();
        const keypair = WalletService.getKeypair(wallet);
        const realmAddress = new PublicKey(config.dao.activeRealm);

        // Get DAO type (integrated or standard)
        const realmInfo = await GovernanceService.getRealmInfo(
          connection,
          realmAddress
        );
        const isIntegrated = realmInfo.isIntegrated;

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

        // Check balance of the source account
        let sourceAddress: PublicKey;
        let sourceBalance: number;

        if (isIntegrated && realmInfo.vaultAddress) {
          // Make sure vaultAddress is defined
          sourceAddress = realmInfo.vaultAddress;
          sourceBalance = await connection.getBalance(sourceAddress);
          console.log(
            `Multisig vault balance: ${sourceBalance / LAMPORTS_PER_SOL} SOL`
          );
        } else {
          sourceAddress = realmInfo.treasuryAddress;
          sourceBalance = await connection.getBalance(sourceAddress);
          console.log(
            `Treasury balance: ${sourceBalance / LAMPORTS_PER_SOL} SOL`
          );
        }

        if (sourceBalance < amount * LAMPORTS_PER_SOL) {
          console.log(
            chalk.yellow(
              `\n⚠️ Warning: Source account doesn't have enough SOL to execute this transfer.`
            )
          );
          console.log(
            chalk.yellow(
              `Balance: ${
                sourceBalance / LAMPORTS_PER_SOL
              } SOL, transfer amount: ${amount} SOL`
            )
          );
          console.log(
            chalk.yellow(`Use 'dao fund' to fund the account first.`)
          );
          throw new Error(
            "Treasury doesn't have enough SOL to execute this transfer."
          );
        }

        console.log(chalk.blue("\nCreating transfer proposal:"));
        console.log(`Name: ${options.name}`);
        console.log(`Description: ${options.description}`);
        console.log(`Amount: ${amount} SOL`);
        console.log(`Recipient: ${recipientAddress.toBase58()}`);

        // Build instructions based on DAO type and transfer type (SOL or Token)
        let instructions: TransactionInstruction[];
        let proposalAddress: PublicKey;

        if (options.mint) {
          // Token transfer
          const tokenMint = new PublicKey(options.mint);
          console.log(`Token mint: ${tokenMint.toBase58()}`);

          if (isIntegrated && realmInfo.multisigAddress) {
            instructions =
              await ProposalService.getSquadsMultisigTokenTransferInstruction(
                connection,
                realmInfo.multisigAddress,
                tokenMint,
                amount,
                recipientAddress
              );

            proposalAddress =
              await ProposalService.createIntegratedAssetTransferProposal(
                connection,
                keypair,
                realmAddress,
                options.name,
                options.description,
                instructions
              );
          } else {
            instructions = await ProposalService.getTokenTransferInstruction(
              connection,
              realmAddress,
              tokenMint,
              amount,
              recipientAddress
            );

            proposalAddress = await ProposalService.createProposal(
              connection,
              keypair,
              realmAddress,
              options.name,
              options.description,
              instructions
            );
          }
        } else {
          // SOL transfer
          if (isIntegrated && realmInfo.multisigAddress) {
            // For integrated DAO, create a multisig transfer
            const transferIx =
              await ProposalService.getSquadsMultisigSolTransferInstruction(
                connection,
                realmInfo.multisigAddress,
                amount,
                recipientAddress
              );

            proposalAddress =
              await ProposalService.createIntegratedAssetTransferProposal(
                connection,
                keypair,
                realmAddress,
                options.name,
                options.description,
                [transferIx]
              );
          } else {
            // For standard DAO, create a treasury transfer
            const transferIx = await ProposalService.getSolTransferInstruction(
              connection,
              realmAddress,
              amount,
              recipientAddress
            );

            proposalAddress = await ProposalService.createProposal(
              connection,
              keypair,
              realmAddress,
              options.name,
              options.description,
              [transferIx]
            );
          }
        }

        console.log(chalk.green(`\n✅ Proposal created successfully!`));
        console.log(
          chalk.green(`Proposal address: ${proposalAddress.toBase58()}`)
        );
        console.log(chalk.blue("\nNext steps:"));
        console.log(`1. Have members vote on the proposal:`);
        console.log(
          `   proposal vote --proposal ${proposalAddress.toBase58()}`
        );
        console.log(`2. Execute the proposal when approved:`);
        console.log(
          `   proposal execute --proposal ${proposalAddress.toBase58()}`
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

  // Add new list command for proposals
  proposalCommand
    .command("list")
    .description("List all proposals for the current DAO")
    .option("--all", "Show all proposals including completed ones", false)
    .option("--limit <number>", "Limit the number of proposals shown", "10")
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
            chalk.yellow(
              'No DAO configured. Use "dao use <ADDRESS>" to select one.'
            )
          );
          return;
        }

        const connection = await ConnectionService.getConnection();
        const realmAddress = new PublicKey(config.dao.activeRealm);

        // Get realm info
        const realmInfo = await GovernanceService.getRealmInfo(
          connection,
          realmAddress
        );

        console.log(
          chalk.blue(`\nFetching proposals for DAO: ${realmInfo.name}`)
        );

        try {
          // Use the new method in GovernanceService to fetch proposals for this realm
          const { proposals } = await GovernanceService.getProposalsForRealm(
            connection,
            realmAddress
          );

          if (proposals.length === 0) {
            console.log(chalk.yellow("No proposals found for this DAO"));
            return;
          }

          // Filter proposals if --all is not specified
          const limit = parseInt(options.limit) || 10;
          const filteredProposals = options.all
            ? proposals
            : proposals.filter(
                (p) =>
                  !p.state.completed && !p.state.cancelled && !p.state.defeated
              );

          // Limit the number of proposals shown
          const limitedProposals = filteredProposals.slice(0, limit);

          console.log(
            chalk.green(
              `\nFound ${
                filteredProposals.length
              } proposals (showing ${Math.min(
                limit,
                filteredProposals.length
              )}):`
            )
          );

          console.log(chalk.bold("\nID | STATE | TITLE | ADDRESS"));
          console.log(chalk.bold("--------------------------------------"));

          // Show each proposal
          limitedProposals.forEach((proposal: ProposalV2, index) => {
            const { chalk: stateColor, text } = getStateColor(proposal);
            console.log(
              `${index + 1}. ${stateColor(text)} | ${chalk.cyan(
                proposal.name
              )} | ${proposal.publicKey.toBase58()}`
            );
          });

          console.log(
            chalk.yellow(
              "\nUse 'proposal vote --proposal <ADDRESS>' to vote on a proposal"
            )
          );
          console.log(
            chalk.yellow(
              "Use 'proposal execute --proposal <ADDRESS>' to execute an approved proposal"
            )
          );

          if (options.all === false && filteredProposals.length > limit) {
            console.log(
              chalk.blue(
                `\nShowing ${limit} of ${filteredProposals.length} proposals. Use --all to show all proposals.`
              )
            );
          }
        } catch (error) {
          console.error(chalk.red("Failed to fetch proposals:"), error);
        }
      } catch (error) {
        console.error(chalk.red("Failed to list proposals:"), error);
      }
    });
}

// Helper function to color code proposal states
function getStateColor(state: ProposalV2): {
  chalk: chalk.Chalk;
  text: string;
} {
  if (state.state.draft) {
    return { chalk: chalk.gray, text: "Draft" };
  }
  if (state.state.signingOff) {
    return { chalk: chalk.yellow, text: "Signing Off" };
  }
  if (state.state.voting) {
    return { chalk: chalk.blue, text: "Voting" };
  }
  if (state.state.succeeded) {
    return { chalk: chalk.green, text: "Succeeded" };
  }
  if (state.state.executing) {
    return { chalk: chalk.green, text: "Executing" };
  }
  if (state.state.completed) {
    return { chalk: chalk.green, text: "Completed" };
  }
  if (state.state.cancelled) {
    return { chalk: chalk.red, text: "Cancelled" };
  }
  if (state.state.defeated) {
    return { chalk: chalk.red, text: "Defeated" };
  }
  return { chalk: chalk.white, text: "Unknown" };
}
