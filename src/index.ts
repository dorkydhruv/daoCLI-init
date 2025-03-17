#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import { registerWalletCommands } from "./commands/wallet";
import { registerConfigCommands } from "./commands/config";
import { registerDaoCommands } from "./commands/dao";
import { registerProposalCommands } from "./commands/proposal";
import { sendFirstUseGATelemetry } from "./utils/googleAnalytics";

async function main() {
  const program = new Command();

  program
    .name("dao")
    .description("Multisig DAO CLI Management Tool")
    .version("1.0.0")
    .option("--noga", "Disable Google Analytics telemetry");

  program.parse(process.argv);
  const options = program.opts();
  await sendFirstUseGATelemetry(options.noga);

  // Register commands
  registerWalletCommands(program);
  registerConfigCommands(program);
  registerDaoCommands(program);
  registerProposalCommands(program);
  // Add a default help command
  program
    .command("help")
    .description("Display help information")
    .action(() => {
      program.help();
    });

  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    console.error(chalk.red("Error executing command:"), error);
    process.exit(1);
  }
}

main();
