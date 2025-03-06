import { Command } from "commander";
import chalk from "chalk";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { ConnectionService } from "../services/connection-service";
import { WalletService } from "../services/wallet-service";
import { MultisigService } from "../services/multisig-service";
import { GovernanceService } from "../services/governance-service";
import { ConfigService } from "../services/config-service";
import * as multisig from "@sqds/multisig";
import { SplGovernance } from "governance-idl-sdk";
import { SPL_GOVERNANCE_PROGRAM_ID } from "../utils/constants";
import { ProposalService } from "../services/proposal-service";

export function registerDaoCommands(program: Command): void {
  const daoCommand = program
    .command("dao")
    .description("DAO management commands");

  daoCommand
    .command("init")
    .description("Initialize a new DAO with multisig and governance")
    .option("-n, --name <string>", "Name of the DAO/realm", "My DAO")
    .option(
      "-t, --threshold <number>",
      "Number of approvals required for multisig",
      "2"
    )
    .option(
      "-m, --members <string>",
      "Comma-separated list of member public keys (including yours)"
    )
    .option(
      "--integrated",
      "Create both SPL Governance and Squads Multisig in an integrated setup",
      true
    )
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

        const connection = await ConnectionService.getConnection();
        const keypair = WalletService.getKeypair(wallet);

        // Parse members
        let members: PublicKey[] = [keypair.publicKey]; // Start with own public key
        if (options.members) {
          const memberStrings = options.members.split(",");
          for (const memberStr of memberStrings) {
            try {
              if (memberStr.trim() !== keypair.publicKey.toBase58()) {
                // Avoid duplicate
                members.push(new PublicKey(memberStr.trim()));
              }
            } catch (e) {
              console.log(
                chalk.yellow(`Skipping invalid public key: ${memberStr}`)
              );
            }
          }
        }

        console.log(
          chalk.blue("Initializing DAO with the following settings:")
        );
        console.log(`Name: ${options.name}`);
        console.log(`Threshold: ${options.threshold} of ${members.length}`);
        console.log("Members:");
        members.forEach((m) => console.log(` - ${m.toBase58()}`));

        // Check account balance first
        const balance = await connection.getBalance(keypair.publicKey);
        if (balance < LAMPORTS_PER_SOL) {
          console.log(
            chalk.yellow(
              `⚠️  Low balance: ${
                balance / LAMPORTS_PER_SOL
              } SOL. You may need at least 1 SOL to create all accounts.`
            )
          );
        }

        // Initialize the entire DAO in one go
        console.log(chalk.blue("\nCreating DAO..."));
        const threshold = parseInt(options.threshold);

        if (options.integrated) {
          console.log(
            chalk.blue("Using integrated mode with Squads Multisig...")
          );

          // First create the DAO
          const daoResult = await GovernanceService.initializeDAO(
            connection,
            keypair,
            options.name,
            members,
            threshold
          );

          // Then create the Squads multisig linked to the DAO using treasury as createKey
          const multisigResult =
            await MultisigService.createDaoControlledMultisig(
              connection,
              keypair,
              threshold,
              members,
              `${options.name}-multisig`,
              daoResult.governanceAddress,
              daoResult.treasuryAddress
            );

          // Save configuration for both
          await ConfigService.setActiveRealm(daoResult.realmAddress.toBase58());
          await ConfigService.setActiveMultisig(
            multisigResult.multisigPda.toBase58()
          );

          console.log(
            chalk.green("\n✅ Integrated DAO initialized successfully!")
          );
          console.log(
            chalk.green(`Realm: ${daoResult.realmAddress.toBase58()}`)
          );
          console.log(
            chalk.green(`Governance: ${daoResult.governanceAddress.toBase58()}`)
          );
          console.log(
            chalk.green(
              `Native Treasury: ${daoResult.treasuryAddress.toBase58()}`
            )
          );
          console.log(
            chalk.green(
              `Squads Multisig: ${multisigResult.multisigPda.toBase58()}`
            )
          );

          // Create vault automatically
          const [vaultPda] = multisig.getVaultPda({
            multisigPda: multisigResult.multisigPda,
            index: 0,
          });
          console.log(chalk.green(`Squads Vault: ${vaultPda.toBase58()}`));

          console.log(chalk.blue("\nNext steps:"));
          console.log("1. Fund your treasury and multisig vault:");
          console.log(`   proposal fund --target treasury --amount 0.1`);
          console.log(`   proposal fund --target multisig --amount 0.1`);
          console.log("2. Create and vote on proposals:");
          console.log(
            `   proposal multisig-transfer --amount 0.01 --recipient [ADDRESS]`
          );
        } else {
          // Standard DAO creation (existing code)
          const result = await GovernanceService.initializeDAO(
            connection,
            keypair,
            options.name,
            members,
            threshold
          );

          // Save configuration
          await ConfigService.setActiveRealm(result.realmAddress.toBase58());

          console.log(chalk.green("\n✅ DAO initialized successfully!"));
          console.log(chalk.green(`Realm: ${result.realmAddress.toBase58()}`));
          console.log(
            chalk.green(`Governance: ${result.governanceAddress.toBase58()}`)
          );
          console.log(
            chalk.green(`Treasury: ${result.treasuryAddress.toBase58()}`)
          );
          console.log(
            chalk.green(`Community Token: ${result.communityMint.toBase58()}`)
          );
          console.log(
            chalk.green(`Council Token: ${result.councilMint.toBase58()}`)
          );
        }

        console.log(chalk.blue("\nNext steps:"));
        console.log("1. Fund your treasury");
      } catch (error) {
        console.error(chalk.red("Failed to initialize DAO:"), error);
      }
    });

  daoCommand
    .command("show")
    .description("Show information about the current DAO")
    .action(async () => {
      try {
        const config = await ConfigService.getConfig();
        if (!config.dao?.activeRealm || !config.dao?.activeMultisig) {
          console.log(
            chalk.yellow('No DAO configured. Use "dao init" to create one.')
          );
          return;
        }

        console.log(chalk.blue("DAO Information:"));
        console.log(chalk.yellow("Realm:"), config.dao.activeRealm);
        console.log(chalk.yellow("Multisig:"), config.dao.activeMultisig);
        console.log(chalk.yellow("Network:"), config.dao.cluster);

        // Here you could fetch more information about the DAO from the chain
        const connection = await ConnectionService.getConnection();

        try {
          // Get treasury balance
          const multisigPda = new PublicKey(config.dao.activeMultisig);
          const balance = await connection.getBalance(multisigPda);
          console.log(
            chalk.yellow("Treasury Balance:"),
            `${balance / LAMPORTS_PER_SOL} SOL`
          );
        } catch (error) {
          console.log(chalk.red("Failed to fetch treasury balance:"), error);
        }
      } catch (error) {
        console.error(chalk.red("Failed to show DAO info:"), error);
      }
    });

  daoCommand
    .command("use")
    .description("Set active DAO")
    .option("-r, --realm <string>", "Realm address to use")
    .option("-m, --multisig <string>", "Multisig address to use")
    .action(async (options) => {
      try {
        if (!options.realm && !options.multisig) {
          console.log(
            chalk.yellow(
              "Please specify either a realm or multisig address to use"
            )
          );
          return;
        }

        if (options.realm) {
          try {
            const realmAddress = new PublicKey(options.realm);
            await ConfigService.setActiveRealm(realmAddress.toBase58());
            console.log(
              chalk.green(`✓ Active realm set to: ${realmAddress.toBase58()}`)
            );
          } catch (e) {
            console.log(chalk.red("Invalid realm address"));
            return;
          }
        }

        if (options.multisig) {
          try {
            const multisigAddress = new PublicKey(options.multisig);
            await ConfigService.setActiveMultisig(multisigAddress.toBase58());
            console.log(
              chalk.green(
                `✓ Active multisig set to: ${multisigAddress.toBase58()}`
              )
            );
          } catch (e) {
            console.log(chalk.red("Invalid multisig address"));
            return;
          }
        }
      } catch (error) {
        console.error(chalk.red("Failed to set active DAO:"), error);
      }
    });

  daoCommand
    .command("fund")
    .description("Fund the DAO treasury or Squads multisig with SOL")
    .option("-a, --amount <number>", "Amount of SOL to deposit", "0.1")
    .option(
      "-t, --target <string>",
      'Target to fund: "treasury" or "multisig"',
      "multisig"
    )
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

        // Parse amount
        const amount = parseFloat(options.amount);
        if (isNaN(amount) || amount <= 0) {
          console.log(
            chalk.red("Invalid amount. Please provide a positive number.")
          );
          return;
        }

        // Determine target (treasury or multisig)
        let targetAddress: PublicKey;

        if (options.target === "multisig") {
          // Get multisig using our deterministic derivation
          const multisigAddress =
            MultisigService.getMultisigForRealm(realmAddress);

          // Get the vault PDA for the multisig
          const [vaultPda] = multisig.getVaultPda({
            multisigPda: multisigAddress,
            index: 0,
          });

          targetAddress = vaultPda;
          console.log(
            chalk.blue(`\nFunding Squads multisig vault with ${amount} SOL:`)
          );
          console.log(`Multisig: ${multisigAddress.toBase58()}`);
          console.log(`Vault: ${vaultPda.toBase58()}`);
        } else {
          // Get the governance account for the realm
          const splGovernance = new SplGovernance(
            connection,
            new PublicKey(SPL_GOVERNANCE_PROGRAM_ID)
          );
          const governanceId = splGovernance.pda.governanceAccount({
            realmAccount: realmAddress,
            seed: realmAddress,
          }).publicKey;

          // Get the native treasury account
          targetAddress = splGovernance.pda.nativeTreasuryAccount({
            governanceAccount: governanceId,
          }).publicKey;
          console.log(
            chalk.blue(`\nFunding native treasury with ${amount} SOL:`)
          );
          console.log(`Treasury: ${targetAddress.toBase58()}`);
        }

        // Fund target
        await ProposalService.fundTreasury(
          connection,
          keypair,
          targetAddress,
          amount
        );

        console.log(
          chalk.green(`\n✅ Successfully funded with ${amount} SOL!`)
        );
      } catch (error) {
        console.error(chalk.red("Failed to fund:"), error);
      }
    });
}
