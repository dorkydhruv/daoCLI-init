import { program } from "commander";
import { PublicKey } from "@solana/web3.js";
import { uuid } from "uuidv4";
import { BN } from "bn.js";
import { Proposal } from "./types/proposal";
import { createProposal } from "./actions/create-proposal";
import { AgentManager } from "./lib/agent";

/*
 * The `program` object is the main entry point for the commander library.
 * It is used to define the command-line interface.
 */

program
  .command("set-network <network>")
  .description("Switch active network")
  .action((network) => {
    AgentManager.switchNetwork(network);
    console.log(`Switched to network ${network}`);
  });

// create-proposal needs (proposalId, description, targetAmount, targetAccount)
// a uuid maybe a good choice for proposalId but in integer form
program
  .command("create-proposal")
  .description("Creates a DAO proposal (for crowd funding)")
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
    // proposal id
    const proposalId = uuid().substring(0, 8);
    try {
      const targetAccount = new PublicKey(options.targetAccount);
      const targetAmount = new BN(parseInt(options.targetAmount));
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

program.parse();
