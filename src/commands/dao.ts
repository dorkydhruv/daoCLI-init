import { Command } from "commander";
import chalk from "chalk";
import {
  PublicKey,
  Keypair,
  LAMPORTS_PER_SOL,
  TransactionInstruction,
} from "@solana/web3.js";
import { ConnectionService } from "../services/connection-service";
import { WalletService } from "../services/wallet-service";
import { MultisigService } from "../services/multisig-service";
import { GovernanceService } from "../services/governance-service";
import { ConfigService } from "../services/config-service";
import BN from "bn.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";

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

  //   daoCommand
  //     .command("list")
  //     .description("List all DAOs you are a member of")
  //     .action(async () => {
  //       try {
  //         const wallet = await WalletService.loadWallet();
  //         if (!wallet) {
  //           console.log(
  //             chalk.red("No wallet configured. Please create a wallet first.")
  //           );
  //           return;
  //         }

  //         const connection = await ConnectionService.getConnection();
  //         const keypair = WalletService.getKeypair(wallet);

  //         console.log(chalk.blue("Fetching DAOs you are a member of..."));

  //         // Get both multisigs and realms the user is part of
  //         const userMultisigs = await MultisigService.getUserMultisigs(
  //           connection,
  //           keypair.publicKey
  //         );

  //         const userRealms = await GovernanceService.getUserRealms(
  //           connection,
  //           keypair.publicKey
  //         );

  //         console.log(chalk.yellow("\nMultisigs:"));
  //         if (userMultisigs.length === 0) {
  //           console.log("  None found");
  //         } else {
  //           userMultisigs.forEach((multisig) => {
  //             console.log(`  - ${multisig.toBase58()}`);
  //           });
  //         }

  //         console.log(chalk.yellow("\nRealms:"));
  //         if (userRealms.length === 0) {
  //           console.log("  None found");
  //         } else {
  //           userRealms.forEach((realm) => {
  //             console.log(`  - ${realm.toBase58()}`);
  //           });
  //         }
  //       } catch (error) {
  //         console.error(chalk.red("Failed to list DAOs:"), error);
  //       }
  //     });

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
}
