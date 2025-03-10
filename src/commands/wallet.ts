import { Command } from "commander";
import chalk from "chalk";
import { WalletService } from "../services/wallet-service";
import { ConnectionService } from "../services/connection-service";
import { ConfigService } from "../services/config-service";

export function registerWalletCommands(program: Command): void {
  const walletCommand = program
    .command("wallet")
    .description("Wallet management commands");

  walletCommand
    .command("create")
    .description("Create a new wallet")
    .action(async () => {
      try {
        const wallet = await WalletService.createWallet();
        console.log(chalk.green("✓ Wallet created successfully!"));
        console.log(chalk.yellow("Public Key:"), wallet.pubkey);
        console.log(
          chalk.yellow(
            "⚠️  WARNING: Keep your secret key safe. Anyone with access to it can control your funds."
          )
        );
      } catch (error) {
        console.error(chalk.red("Failed to create wallet:"), error);
      }
    });

  walletCommand
    .command("import")
    .description("Import an existing wallet")
    .argument(
      "<secretKey>",
      "Secret key as an array, base58 string, or path to keypair file"
    )
    .action(async (secretKey) => {
      try {
        const wallet = await WalletService.importWallet(secretKey);
        console.log(chalk.green("✓ Wallet imported successfully!"));
        console.log(chalk.yellow("Public Key:"), wallet.pubkey);
      } catch (error) {
        console.error(chalk.red("Failed to import wallet:"), error);
      }
    });

  walletCommand
    .command("show")
    .description("Display current wallet information")
    .action(async () => {
      try {
        const wallet = await WalletService.loadWallet();
        const config = await ConfigService.getConfig();

        if (!wallet) {
          console.log(
            chalk.yellow(
              'No wallet configured. Use "dao wallet create" to create one.'
            )
          );
          return;
        }

        console.log(chalk.blue("Wallet Information:"));
        console.log(chalk.yellow("Public Key:"), wallet.pubkey);

        try {
          const connection = await ConnectionService.getConnection();
          const balance = await WalletService.getBalance(
            connection,
            wallet.pubkey
          );
          console.log(chalk.yellow("Balance:"), `${balance} SOL`);
          console.log(
            chalk.yellow("Network:"),
            config.dao?.cluster || "Not set"
          );
        } catch (error) {
          console.log(chalk.red("Could not fetch balance:"), error);
        }
      } catch (error) {
        console.error(chalk.red("Failed to load wallet:"), error);
      }
    });
}
