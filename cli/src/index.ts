import { program } from "commander";
import { PublicKey } from "@solana/web3.js";
import { Proposal } from "./types/proposal";
import { createProposal } from "./actions/create-proposal";
import { AgentManager } from "./lib/agent";
import { executeProposal } from "./actions/execute-proposal";
import { contribute } from "./actions/contribute";
import { randomUUID } from "crypto";

/*
 * The `program` object is the main entry point for the commander library.
 * It is used to define the command-line interface.
 */

program
  .command("set-network <network>")
  .description("Switch active network (devnet, testnet, mainnet, or localnet)")
  .action((network) => {
    const validNetworks = ["devnet", "testnet", "mainnet", "localnet"];
    if (!validNetworks.includes(network)) {
      console.error(
        `Invalid network. Must be one of: ${validNetworks.join(", ")}`
      );
      return;
    }
    try {
      AgentManager.switchNetwork(
        network as "devnet" | "testnet" | "mainnet" | "localnet"
      );
    } catch (error) {
      console.error(`Failed to switch network: ${error}`);
    }
  });

// create-proposal needs (proposalId, description, targetAmount, targetAccount)
// a uuid maybe a good choice for proposalId but in integer form
program
  .command("create")
  .description("Creates a DAO proposal (for crowd funding)")
  .option(
    "-i, --proposalId <proposalId>",
    "proposal unique identifier",
    randomUUID().substring(0, 8)
  )
  .option(
    "-d, --description <description>",
    "description of the proposal",
    "A crowd funding proposal"
  )
  .requiredOption(
    "-a, --targetAmount <targetAmount>",
    "target amount of the proposal"
  )
  .requiredOption(
    "-t, --targetAccount <targetAccount>",
    "target account of the proposal"
  )
  .requiredOption("-m, --mint <mint>", "mint of the token accepted")
  .action(async (options) => {
    const proposalId = options.proposalId;
    try {
      const targetAccount = new PublicKey(options.targetAccount);
      const targetAmount = parseInt(options.targetAmount);
      const mint = new PublicKey(options.mint);
      console.log(
        `Creating proposal with ID ${proposalId.toString()} and description ${
          options.description
        } for target amount ${targetAmount} to target account ${targetAccount.toString()}`
      );
      const proposal: Proposal = {
        proposalId: proposalId,
        description: options.description,
        targetAmount,
        targetAccount,
        mint,
      };
      await createProposal(proposal);
    } catch (err) {
      console.log(`Error: ${err}`);
    }
  });

program
  .command("contribute <proposalAccount> <amount>")
  .action(async (proposalAccount, amount) => {
    console.log(`Contributing ${amount} to proposal ${proposalAccount}....`);
    contribute(new PublicKey(proposalAccount), parseInt(amount));
  });

program.command("execute <proposalAccount>").action(async (proposalAccount) => {
  console.log(`Executing proposal with ${proposalAccount}...`);
  executeProposal(new PublicKey(proposalAccount));
});

program.parse();
