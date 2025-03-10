import { Command } from "commander";
import chalk from "chalk";
import { ConfigService } from "../services/config-service";
import { CLUSTERS, ENDPOINT_MAP } from "../utils/constants";
import { Cluster } from "@solana/web3.js";

export function registerConfigCommands(program: Command): void {
  const configCommand = program
    .command("config")
    .description("Configuration management commands");

  configCommand
    .command("show")
    .description("Display current configuration")
    .action(async () => {
      try {
        const config = await ConfigService.getConfig();
        console.log(chalk.blue("Configuration:"));
        console.log(JSON.stringify(config, null, 2));
      } catch (error) {
        console.error(chalk.red("Failed to load configuration:"), error);
      }
    });

  configCommand
    .command("set-cluster")
    .description("Set the Solana cluster")
    .argument("<cluster>", `Cluster name: ${Object.keys(CLUSTERS).join(", ")}`)
    .option("-e, --endpoint <string>", "Custom RPC endpoint URL")
    .action(async (clusterName, options) => {
      try {
        if (!CLUSTERS[clusterName]) {
          console.error(
            chalk.red(
              `Invalid cluster. Choose from: ${Object.keys(CLUSTERS).join(
                ", "
              )}`
            )
          );
          return;
        }

        const cluster = CLUSTERS[clusterName] as Cluster;
        const endpoint = options.endpoint || ENDPOINT_MAP[cluster];

        await ConfigService.setCluster(cluster, endpoint);
        console.log(
          chalk.green(
            `✓ Cluster set to ${clusterName} with endpoint: ${endpoint}`
          )
        );
      } catch (error) {
        console.error(chalk.red("Failed to set cluster:"), error);
      }
    });
}
