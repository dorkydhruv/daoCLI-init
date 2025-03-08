import { execSync } from "child_process";
import { describe, it, before, after } from "mocha";
import { expect } from "chai";
import {
  Connection,
  PublicKey,
  Keypair,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import path from "path";
import fs from "fs-extra";

import { DEFAULT_CLUSTER, ENDPOINT_MAP } from "../src/utils/constants";

describe("Integrated DAO Workflow Test", function () {
  this.timeout(300000); // 5 minutes timeout for the entire test suite

  let connection: Connection;
  let walletPath: string;
  let keypair: Keypair;
  let recipientKeypair: Keypair;

  // We'll track addresses from CLI outputs to verify them in subsequent commands
  let realmAddress: string;
  let multisigAddress: string;
  let vaultAddress: string;
  let treasuryAddress: string;
  let proposalAddress: string;

  const CLI_COMMAND = "yarn dev";
  const initialFundAmount = 0.5;
  const transferAmount = 0.1;

  function executeCommand(command: string): string {
    try {
      const fullCommand = `${CLI_COMMAND} ${command}`;
      console.log(`Executing: ${fullCommand}`);
      const result = execSync(fullCommand, { encoding: "utf8" });
      return result;
    } catch (error: any) {
      // Type the error as 'any' to allow accessing properties
      console.error(`Command failed: ${error.message || "Unknown error"}`);
      if (error.stdout) console.error(`Error stdout: ${error.stdout}`);
      if (error.stderr) console.error(`Error stderr: ${error.stderr}`);
      throw error;
    }
  }

  before(async () => {
    // Clear existing config
    const configDir = path.join(process.env.HOME || "", ".config/daoCLI");
    if (fs.existsSync(configDir)) {
      fs.removeSync(configDir);
    }

    // Set up connection
    connection = new Connection(ENDPOINT_MAP[DEFAULT_CLUSTER], {
      commitment: "confirmed",
    });

    // Import wallet from file
    walletPath = path.join(process.env.HOME || "", ".config/solana/id.json");
    expect(fs.existsSync(walletPath), "Wallet file does not exist").to.be.true;

    const walletData = fs.readFileSync(walletPath, "utf8");
    const secretKey = Uint8Array.from(JSON.parse(walletData));
    keypair = Keypair.fromSecretKey(secretKey);

    console.log(`Using wallet: ${keypair.publicKey.toBase58()}`);

    // Import the wallet into our CLI tool
    executeCommand(`wallet import ${walletPath}`);

    // Create a recipient keypair for testing transfers
    recipientKeypair = Keypair.generate();
    console.log(
      `Test recipient address: ${recipientKeypair.publicKey.toBase58()}`
    );

    // Check wallet balance
    const balance = await connection.getBalance(keypair.publicKey);
    console.log(`Wallet balance: ${balance / LAMPORTS_PER_SOL} SOL`);

    if (balance < LAMPORTS_PER_SOL) {
      console.log("Wallet balance too low, attempting to airdrop on devnet");
      if (DEFAULT_CLUSTER === "testnet") {
        const airdropSig = await connection.requestAirdrop(
          keypair.publicKey,
          LAMPORTS_PER_SOL
        );
        await connection.confirmTransaction(airdropSig);
      } else {
        throw new Error("Wallet needs at least 1 SOL for tests");
      }
    }
  });

  it("should create an integrated DAO with multisig", async () => {
    const daoName = `IntegratedTest-${Date.now().toString().substring(6)}`;
    console.log(`Creating integrated DAO: ${daoName}`);

    // Create the integrated DAO
    const output = executeCommand(
      `dao init --name "${daoName}" --threshold 1 --integrated`
    );

    // Extract addresses from output
    const realmMatch = output.match(/Realm: ([A-Za-z0-9]+)/);
    const governanceMatch = output.match(/Governance: ([A-Za-z0-9]+)/);
    const treasuryMatch = output.match(/Native Treasury: ([A-Za-z0-9]+)/);
    const multisigMatch = output.match(/Squads Multisig: ([A-Za-z0-9]+)/);
    const vaultMatch = output.match(/Squads Vault: ([A-Za-z0-9]+)/);

    // Save the addresses for later tests
    realmAddress = realmMatch ? realmMatch[1] : "";
    treasuryAddress = treasuryMatch ? treasuryMatch[1] : "";
    multisigAddress = multisigMatch ? multisigMatch[1] : "";
    vaultAddress = vaultMatch ? vaultMatch[1] : "";

    // Verify we got all the addresses
    expect(realmAddress, "Realm address not found in output").to.not.be.empty;
    expect(treasuryAddress, "Treasury address not found in output").to.not.be
      .empty;
    expect(multisigAddress, "Multisig address not found in output").to.not.be
      .empty;
    expect(vaultAddress, "Vault address not found in output").to.not.be.empty;

    // Verify that the accounts exist on-chain
    const realmAccountInfo = await connection.getAccountInfo(
      new PublicKey(realmAddress)
    );
    expect(realmAccountInfo, "Realm account not found on-chain").to.not.be.null;

    const multisigAccountInfo = await connection.getAccountInfo(
      new PublicKey(multisigAddress)
    );
    expect(multisigAccountInfo, "Multisig account not found on-chain").to.not.be
      .null;

    // Verify that the correct DAO is selected
    const showOutput = executeCommand("dao show");
    expect(showOutput).to.include(realmAddress);
    expect(showOutput).to.include(multisigAddress);
    expect(showOutput).to.include("Integrated with Squads Multisig");

    console.log(
      `Created DAO with realm: ${realmAddress}, multisig: ${multisigAddress}`
    );
  });

  it("should fund the multisig vault", async () => {
    const initialVaultBalance = await connection.getBalance(
      new PublicKey(vaultAddress)
    );
    console.log(
      `Initial vault balance: ${initialVaultBalance / LAMPORTS_PER_SOL} SOL`
    );

    // Fund the vault using the CLI
    executeCommand(`dao fund --amount ${initialFundAmount}`);

    // Wait for transaction confirmation
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Verify funds were received
    const newVaultBalance = await connection.getBalance(
      new PublicKey(vaultAddress)
    );
    console.log(`New vault balance: ${newVaultBalance / LAMPORTS_PER_SOL} SOL`);

    // Check that the balance increased by at least 95% of the funded amount (accounting for fees)
    expect(newVaultBalance).to.be.greaterThan(
      initialVaultBalance + initialFundAmount * LAMPORTS_PER_SOL * 0.95
    );
  });

  it("should create a transfer proposal in the integrated setup", async () => {
    // Create a proposal to transfer SOL from the vault to our test recipient
    const output = executeCommand(
      `proposal transfer --amount ${transferAmount} --recipient ${recipientKeypair.publicKey.toBase58()} --name "Test Integrated Transfer"`
    );

    // Extract the proposal address from output
    const proposalMatch = output.match(/Proposal address: ([A-Za-z0-9]+)/);
    proposalAddress = proposalMatch ? proposalMatch[1] : "";

    expect(proposalAddress, "Proposal address not found in output").to.not.be
      .empty;

    // Verify the proposal exists on-chain
    const proposalAccountInfo = await connection.getAccountInfo(
      new PublicKey(proposalAddress)
    );
    expect(proposalAccountInfo, "Proposal account not found on-chain").to.not.be
      .null;

    // List proposals to verify our proposal appears in the list
    const listOutput = executeCommand("proposal list");
    expect(listOutput).to.include(proposalAddress);
    expect(listOutput).to.include("Test Integrated Transfer");
  });

  it("should vote on the proposal", async () => {
    // Vote to approve the proposal
    const output = executeCommand(
      `proposal vote --proposal ${proposalAddress}`
    );
    expect(output).to.include("Vote cast successfully");

    // Wait for transaction confirmation
    await new Promise((resolve) => setTimeout(resolve, 5000));
  });


  after(async () => {
    // Clean up config
    const configDir = path.join(process.env.HOME || "", ".config/daoCLI");
    if (fs.existsSync(configDir)) {
      fs.removeSync(configDir);
    }
  });
});
