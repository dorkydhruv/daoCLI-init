import { Command } from "commander";
import chalk from "chalk";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { ConnectionService } from "../services/connection-service";
import { WalletService } from "../services/wallet-service";
import { MultisigService } from "../services/multisig-service";
import { GovernanceService } from "../services/governance-service";
import { ConfigService } from "../services/config-service";
import * as multisig from "@sqds/multisig";
import { ProposalService } from "../services/proposal-service";
import { SplGovernance } from "governance-idl-sdk";
import { SPL_GOVERNANCE_PROGRAM_ID } from "../utils/constants";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

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
      "--integrated <boolean>",
      "Create both SPL Governance and Squads Multisig in an integrated setup",
      true
    )
    .action(async (options) => {
      try {
        // Load wallet and connection
        const walletRes = await WalletService.loadWallet();
        if (!walletRes.success || !walletRes.data) {
          console.log(
            chalk.red("No wallet configured. Please create a wallet first.")
          );
          return;
        }

        const connectionRes = await ConnectionService.getConnection();
        if (!connectionRes.success || !connectionRes.data) {
          console.log(chalk.red("Failed to establish connection"));
          return;
        }

        const connection = connectionRes.data;
        const keypair = WalletService.getKeypair(walletRes.data);

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
        if (balance < 0.1 * LAMPORTS_PER_SOL) {
          console.log(
            chalk.yellow(
              `⚠️  Low balance: ${
                balance / LAMPORTS_PER_SOL
              } SOL. You may need at least 0.1 SOL to create all accounts.`
            )
          );
        }

        // Initialize the entire DAO in one go
        console.log(chalk.blue("\nCreating DAO..."));
        const threshold = parseInt(options.threshold);
        if (members.length < threshold) {
          console.log(
            chalk.red(
              `Threshold should be less than or equal to number of members`
            )
          );
          return;
        }

        const integrated =
          (typeof options.integrated === "string"
            ? options.integrated.toLowerCase() === "true"
            : options.integrated) || false;
        // First create the DAO
        const daoResult = await GovernanceService.initializeDAO(
          connection,
          keypair,
          options.name,
          members,
          threshold
        );

        if (!daoResult.success || !daoResult.data) {
          console.log(
            chalk.red("Failed to initialize DAO:"),
            daoResult.error?.message,
            daoResult.error?.details
              ? JSON.stringify(daoResult.error.details, null, 2)
              : ""
          );
          return;
        }

        // Only store the realm address in config
        const configResult = await ConfigService.setActiveRealm(
          daoResult.data.realmAddress.toBase58()
        );
        if (!configResult.success) {
          console.log(
            chalk.yellow("Warning: Failed to save configuration:"),
            configResult.error?.message
          );
        }
        console.log(chalk.green("\n✅ DAO initialized successfully!"));
        console.log(
          chalk.green(`Realm: ${daoResult.data.realmAddress.toBase58()}`)
        );
        console.log(
          chalk.green(
            `Governance: ${daoResult.data.governanceAddress.toBase58()}`
          )
        );
        console.log(
          chalk.green(`Treasury: ${daoResult.data.treasuryAddress.toBase58()}`)
        );
        console.log(
          chalk.green(
            `Community Token: ${daoResult.data.communityMint.toBase58()}`
          )
        );
        console.log(
          chalk.green(`Council Token: ${daoResult.data.councilMint.toBase58()}`)
        );
        if (integrated) {
          console.log(
            chalk.blue("Using integrated mode with Squads Multisig...")
          );

          // Then create the Squads multisig linked to the DAO using treasury as createKey
          const multisigResult =
            await MultisigService.createDaoControlledMultisig(
              connection,
              keypair,
              threshold,
              members,
              `${options.name}-multisig`,
              daoResult.data.realmAddress
            );

          if (!multisigResult.success || !multisigResult.data) {
            console.log(
              chalk.red("Failed to create multisig:"),
              multisigResult.error?.message
            );
            return;
          }

          console.log(
            chalk.green("\n✅ Integrated DAO initialized successfully!")
          );
          console.log(
            chalk.green(
              `Squads Multisig: ${multisigResult.data.multisigPda.toBase58()}`
            )
          );
          const [vaultPda] = multisig.getVaultPda({
            multisigPda: multisigResult.data.multisigPda,
            index: 0,
          });
          console.log(chalk.green(`Squads Vault: ${vaultPda.toBase58()}`));
        }
        console.log(chalk.blue("\nNext steps:"));
        console.log("1. Fund your vault:");
        console.log(` $ daocli dao fund --amount 0.1`);
        console.log(` $ daocli dao fund-token --mint <mint> --amount <amount>`);
        console.log("2. Create and vote on proposals:");
        console.log(`   proposal transfer --amount 0.01 --recipient <address>`);
      } catch (error) {
        console.error(chalk.red("Failed to initialize DAO:"), error);
      }
    });

  daoCommand
    .command("show")
    .description("Show information about the current DAO")
    .action(async () => {
      try {
        const configRes = await ConfigService.getConfig();
        if (
          !configRes.success ||
          !configRes.data ||
          !configRes.data.dao?.activeRealm
        ) {
          console.log(
            chalk.yellow(
              'No DAO configured. Use "dao use <ADDRESS>" to select one.'
            )
          );
          return;
        }

        const realmAddress = new PublicKey(configRes.data.dao.activeRealm);

        const connectionRes = await ConnectionService.getConnection();
        if (!connectionRes.success || !connectionRes.data) {
          console.log(chalk.red("Failed to establish connection"));
          return;
        }

        const connection = connectionRes.data;

        const realmInfoRes = await GovernanceService.getRealmInfo(
          connection,
          realmAddress
        );
        if (!realmInfoRes.success || !realmInfoRes.data) {
          console.log(
            chalk.red("Failed to get DAO information:"),
            realmInfoRes.error?.message
          );
          return;
        }

        const realmInfo = realmInfoRes.data;

        console.log(chalk.blue("DAO Information:"));
        console.log(chalk.yellow("Realm:"), realmAddress.toBase58());
        console.log(chalk.yellow("Name:"), realmInfo.name);
        console.log(
          chalk.yellow("Governance:"),
          realmInfo.governanceAddress.toBase58()
        );
        console.log(
          chalk.yellow("Treasury:"),
          realmInfo.treasuryAddress.toBase58()
        );
        console.log(
          chalk.yellow("Type:"),
          realmInfo.isIntegrated
            ? "Integrated with Squads Multisig"
            : "Standard DAO"
        );
        console.log(chalk.yellow("Network:"), configRes.data.dao.cluster);

        // Show treasury balance
        if (realmInfo.treasuryBalance !== undefined) {
          console.log(
            chalk.yellow("Treasury Balance:"),
            `${realmInfo.treasuryBalance} SOL`
          );
        } else {
          const treasuryBalance = await connection.getBalance(
            realmInfo.treasuryAddress
          );
          console.log(
            chalk.yellow("Treasury Balance:"),
            `${treasuryBalance / LAMPORTS_PER_SOL} SOL`
          );
        }

        // Show multisig info if integrated
        if (
          realmInfo.isIntegrated &&
          realmInfo.multisigAddress &&
          realmInfo.vaultAddress
        ) {
          console.log(chalk.blue("\nSquads Multisig Information:"));
          console.log(
            chalk.yellow("Multisig:"),
            realmInfo.multisigAddress.toBase58()
          );
          console.log(
            chalk.yellow("Vault:"),
            realmInfo.vaultAddress.toBase58()
          );

          // Get multisig state
          const multisigInfoRes = await MultisigService.getMultisigInfo(
            connection,
            realmInfo.multisigAddress
          );
          if (multisigInfoRes.success && multisigInfoRes.data) {
            console.log(
              chalk.yellow("Members:"),
              multisigInfoRes.data.memberCount
            );
            console.log(
              chalk.yellow("Threshold:"),
              multisigInfoRes.data.threshold
            );
          }

          // Show vault balance
          if (realmInfo.vaultBalance !== undefined) {
            console.log(
              chalk.yellow("Vault Balance:"),
              `${realmInfo.vaultBalance} SOL`
            );
          } else {
            const vaultBalance = await connection.getBalance(
              realmInfo.vaultAddress
            );
            console.log(
              chalk.yellow("Vault Balance:"),
              `${vaultBalance / LAMPORTS_PER_SOL} SOL`
            );
          }
        }
      } catch (error) {
        console.error(chalk.red("Failed to show DAO info:"), error);
      }
    });

  daoCommand
    .command("use")
    .description("Set active DAO by realm address")
    .argument("<address>", "Realm address to use")
    .action(async (address) => {
      try {
        let realmAddress: PublicKey;

        try {
          realmAddress = new PublicKey(address);
        } catch (e) {
          console.log(chalk.red("Invalid realm address"));
          return;
        }

        const connectionRes = await ConnectionService.getConnection();
        if (!connectionRes.success || !connectionRes.data) {
          console.log(chalk.red("Failed to establish connection"));
          return;
        }

        const connection = connectionRes.data;

        try {
          // Get information about the realm
          const realmInfoRes = await GovernanceService.getRealmInfo(
            connection,
            realmAddress
          );
          if (!realmInfoRes.success || !realmInfoRes.data) {
            console.log(
              chalk.red(
                `Could not find realm at address: ${realmAddress.toBase58()}`
              )
            );
            console.log(
              chalk.yellow(
                "If this is a new realm, create it first with 'dao init'"
              )
            );
            return;
          }

          // Store only the realm address in config
          const configRes = await ConfigService.setActiveRealm(
            realmAddress.toBase58()
          );
          if (!configRes.success) {
            console.log(
              chalk.red("Failed to save realm address to config:"),
              configRes.error?.message
            );
            return;
          }

          const realmInfo = realmInfoRes.data;
          console.log(
            chalk.green(`✓ Active DAO set to: ${realmAddress.toBase58()}`)
          );
          console.log(chalk.blue(`DAO Name: ${realmInfo.name}`));
          console.log(
            chalk.blue(`Governance: ${realmInfo.governanceAddress.toBase58()}`)
          );
          console.log(
            chalk.blue(`Treasury: ${realmInfo.treasuryAddress.toBase58()}`)
          );

          if (realmInfo.isIntegrated) {
            console.log(
              chalk.blue(`\nThis is an integrated DAO with Squads Multisig`)
            );
            console.log(
              chalk.blue(`Multisig: ${realmInfo.multisigAddress?.toBase58()}`)
            );
            console.log(
              chalk.blue(`Vault: ${realmInfo.vaultAddress?.toBase58()}`)
            );
          } else {
            console.log(
              chalk.blue(
                `\nThis is a standard DAO without Squads Multisig integration`
              )
            );
          }
        } catch (error) {
          console.log(
            chalk.red(
              `Could not find realm at address: ${realmAddress.toBase58()}`
            )
          );
          console.log(
            chalk.yellow(
              "If this is a new realm, create it first with 'dao init'"
            )
          );
          return;
        }
      } catch (error) {
        console.error(chalk.red("Failed to set active DAO:"), error);
      }
    });

  daoCommand
    .command("fund")
    .description("Fund the active DAO (treasury or multisig vault)")
    .option("-a, --amount <number>", "Amount of SOL to deposit", "0.1")
    .action(async (options) => {
      try {
        // Load wallet and connection
        const walletRes = await WalletService.loadWallet();
        if (!walletRes.success || !walletRes.data) {
          console.log(
            chalk.red("No wallet configured. Please create a wallet first.")
          );
          return;
        }

        // Check config
        const configRes = await ConfigService.getConfig();
        if (
          !configRes.success ||
          !configRes.data ||
          !configRes.data.dao?.activeRealm
        ) {
          console.log(
            chalk.yellow(
              'No DAO configured. Use "dao use <ADDRESS>" to select one.'
            )
          );
          return;
        }

        const connectionRes = await ConnectionService.getConnection();
        if (!connectionRes.success || !connectionRes.data) {
          console.log(chalk.red("Failed to establish connection"));
          return;
        }

        const connection = connectionRes.data;
        const keypair = WalletService.getKeypair(walletRes.data);
        const realmAddress = new PublicKey(configRes.data.dao.activeRealm);

        // Parse amount
        const amount = parseFloat(options.amount);
        if (isNaN(amount) || amount <= 0) {
          console.log(
            chalk.red("Invalid amount. Please provide a positive number.")
          );
          return;
        }

        // Get DAO info to determine where to send funds
        const realmInfoRes = await GovernanceService.getRealmInfo(
          connection,
          realmAddress
        );
        if (!realmInfoRes.success || !realmInfoRes.data) {
          console.log(
            chalk.red("Failed to get DAO information:"),
            realmInfoRes.error?.message
          );
          return;
        }

        const realmInfo = realmInfoRes.data;

        // Determine target based on whether this is an integrated DAO
        let targetAddress: PublicKey;

        if (realmInfo.isIntegrated && realmInfo.vaultAddress) {
          // For integrated DAOs, fund the multisig vault
          targetAddress = realmInfo.vaultAddress;
          console.log(
            chalk.blue(`\nFunding Squads multisig vault with ${amount} SOL:`)
          );
          console.log(
            `Multisig: ${
              realmInfo.multisigAddress
                ? realmInfo.multisigAddress.toBase58()
                : "Unknown"
            }`
          );
          console.log(`Vault: ${targetAddress.toBase58()}`);
        } else {
          // For standard DAOs, fund the treasury
          targetAddress = realmInfo.treasuryAddress;
          console.log(
            chalk.blue(`\nFunding native treasury with ${amount} SOL:`)
          );
          console.log(`Treasury: ${targetAddress.toBase58()}`);
        }

        // Fund target
        const fundRes = await GovernanceService.fundTreasury(
          connection,
          keypair,
          targetAddress,
          amount
        );
        if (!fundRes.success) {
          console.log(chalk.red("Failed to fund:"), fundRes.error?.message);
          return;
        }

        console.log(
          chalk.green(`\n✅ Successfully funded with ${amount} SOL!`)
        );
        console.log(chalk.blue(`Transaction: ${fundRes.data}`));
      } catch (error) {
        console.error(chalk.red("Failed to fund:"), error);
      }
    });

  daoCommand
    .command("list")
    .description("List all DAOs where you are a member")
    .action(async () => {
      try {
        // Load wallet and connection
        const walletRes = await WalletService.loadWallet();
        if (!walletRes.success || !walletRes.data) {
          console.log(
            chalk.red("No wallet configured. Please create a wallet first.")
          );
          return;
        }

        const connectionRes = await ConnectionService.getConnection();
        if (!connectionRes.success || !connectionRes.data) {
          console.log(chalk.red("Failed to establish connection"));
          return;
        }

        const connection = connectionRes.data;
        const keypair = WalletService.getKeypair(walletRes.data);

        console.log(chalk.blue("Searching for your DAOs..."));
        console.log(
          chalk.yellow("This may take some time depending on your connection.")
        );

        // Two approaches to find DAOs:
        // 1. Check token accounts with zero decimals (council tokens)
        // 2. Find TokenOwnerRecords that reference this wallet

        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
          keypair.publicKey,
          { programId: TOKEN_PROGRAM_ID }
        );

        const zeroDecimalTokens = tokenAccounts.value.filter((account) => {
          const tokenAmount = account.account.data.parsed.info.tokenAmount;
          return tokenAmount.uiAmount > 0;
        });

        // Get token mints
        const communityMints = zeroDecimalTokens.map(
          (token) => token.account.data.parsed.info.mint
        );

        console.log(
          `Found ${communityMints.length} potential community token(s)`
        );

        const splGovernance = new SplGovernance(
          connection,
          new PublicKey(SPL_GOVERNANCE_PROGRAM_ID)
        );

        // Get all realms and find matches
        console.log("Fetching realms from governance program...");
        const allRealms = await splGovernance.getAllRealms();

        if (allRealms.length === 0) {
          console.log(chalk.yellow("No realms found in the current network."));
          return;
        }

        // Filter realms where user has council tokens
        const userRealms = allRealms.filter(
          (realm) =>
            realm.config.councilMint &&
            communityMints.includes(realm.communityMint.toBase58())
        );

        if (userRealms.length === 0) {
          console.log(chalk.yellow("You are not a member of any DAOs"));
          return;
        }

        console.log(
          chalk.green(
            `\nFound ${userRealms.length} DAOs where you are a member:`
          )
        );
        console.log(chalk.bold("\nINDEX | NAME | TYPE | ADDRESS"));
        console.log(chalk.bold("--------------------------------------"));

        // Process realms to check if they are integrated DAOs
        const realmPromises = userRealms.map(async (realm, index) => {
          try {
            const isIntegratedRes = await GovernanceService.isIntegratedDao(
              connection,
              realm.publicKey
            );

            return {
              index: index + 1,
              name: realm.name,
              isIntegrated: isIntegratedRes.success && isIntegratedRes.data,
              address: realm.publicKey,
            };
          } catch (error) {
            return {
              index: index + 1,
              name: realm.name,
              isIntegrated: false,
              address: realm.publicKey,
            };
          }
        });

        const processedRealms = await Promise.all(realmPromises);

        // Display results
        processedRealms.forEach((realm) => {
          const type = realm.isIntegrated ? "Integrated" : "Standard";
          console.log(
            `${realm.index}. ${chalk.green(realm.name)} | ${chalk.blue(
              type
            )} | ${realm.address.toBase58()}`
          );
        });

        console.log(
          chalk.yellow(
            "\nUse 'dao use <ADDRESS>' to select a DAO from the list"
          )
        );
      } catch (error) {
        console.error(chalk.red("Failed to list DAOs:"), error);
      }
    });

  daoCommand
    .command("fund-token")
    .description("Fund token accounts for the active DAO")
    .option("-m, --mint <string>", "Token mint address to fund")
    .option(
      "-a, --amount <number>",
      "Amount of tokens to transfer (decimal notation)",
      "100"
    )
    .option(
      "-r, --recipient <string>",
      "Optional recipient address (defaults to active DAO)"
    )
    .action(async (options) => {
      try {
        // Load wallet and connection
        const walletRes = await WalletService.loadWallet();
        if (!walletRes.success || !walletRes.data) {
          console.log(
            chalk.red("No wallet configured. Please create a wallet first.")
          );
          return;
        }

        // Check config
        const configRes = await ConfigService.getConfig();
        if (
          !configRes.success ||
          !configRes.data ||
          !configRes.data.dao?.activeRealm
        ) {
          console.log(
            chalk.yellow(
              'No DAO configured. Use "dao use <ADDRESS>" to select one.'
            )
          );
          return;
        }

        // Check mint address
        if (!options.mint) {
          console.log(chalk.red("Token mint address is required"));
          console.log(
            chalk.yellow(
              "Usage: dao fund-token --mint <TOKEN_MINT_ADDRESS> --amount <AMOUNT>"
            )
          );
          return;
        }

        const connectionRes = await ConnectionService.getConnection();
        if (!connectionRes.success || !connectionRes.data) {
          console.log(chalk.red("Failed to establish connection"));
          return;
        }

        const connection = connectionRes.data;
        const keypair = WalletService.getKeypair(walletRes.data);
        const realmAddress = new PublicKey(configRes.data.dao.activeRealm);

        // Parse token mint
        let tokenMint: PublicKey;
        try {
          tokenMint = new PublicKey(options.mint);
        } catch (e) {
          console.log(chalk.red("Invalid token mint address"));
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

        // Get DAO info
        const realmInfoRes = await GovernanceService.getRealmInfo(
          connection,
          realmAddress
        );
        if (!realmInfoRes.success || !realmInfoRes.data) {
          console.log(
            chalk.red("Failed to get DAO information:"),
            realmInfoRes.error?.message
          );
          return;
        }

        const realmInfo = realmInfoRes.data;

        // Determine recipient address
        let recipientAddress: PublicKey;

        if (options.recipient) {
          try {
            recipientAddress = new PublicKey(options.recipient);
          } catch (e) {
            console.log(chalk.red("Invalid recipient address"));
            return;
          }
        } else {
          // Use the appropriate treasury based on DAO type
          if (realmInfo.isIntegrated && realmInfo.vaultAddress) {
            recipientAddress = realmInfo.vaultAddress;
            console.log(
              chalk.blue(
                `Using multisig vault as recipient: ${recipientAddress.toBase58()}`
              )
            );
          } else {
            recipientAddress = realmInfo.treasuryAddress;
            console.log(
              chalk.blue(
                `Using DAO treasury as recipient: ${recipientAddress.toBase58()}`
              )
            );
          }
        }

        // Fund token account
        const fundRes = await GovernanceService.fundTokenAccount(
          connection,
          keypair,
          tokenMint,
          recipientAddress,
          amount
        );

        if (!fundRes.success) {
          console.log(
            chalk.red("Failed to fund token account:"),
            fundRes.error?.message
          );
          return;
        }

        console.log(chalk.green(`\n✅ Successfully funded token account!`));
        console.log(chalk.blue(`Transaction: ${fundRes.data}`));
      } catch (error) {
        console.error(chalk.red("Failed to fund token account:"), error);
      }
    });
}
