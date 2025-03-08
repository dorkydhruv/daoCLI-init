import {
  Connection,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { spawnSync } from "child_process";
import path from "path";
import fs from "fs-extra";
import { expect } from "chai";
import { SplGovernance } from "governance-idl-sdk";
import {
  SPL_GOVERNANCE_PROGRAM_ID,
  SQDS_PROGRAM_ID,
} from "../src/utils/constants";
import { ConfigService } from "../src/services/config-service";

describe("Standard DAO Test", function () {
  // Extend mocha timeout since blockchain operations take time
  this.timeout(300000); // 5 minutes to handle slow CI environments

  const CLI_PATH = path.resolve(__dirname, "../src/index.ts");
  const CLI_CMD = "ts-node";
  const CONFIG_DIR = path.join(process.env.HOME || "", ".config", "dao-cli");
  const WALLET_PATH = path.join(CONFIG_DIR, "wallet.json");
  const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");

  // Test parameters
  const daoName = `StdDAO-${Math.floor(Math.random() * 10000)}`;
  const threshold = 1; // For simplicity in testing
  const fundAmount = 0.2;
  const transferAmount = 0.05;

  // Store keypairs/addresses
  let wallet: Keypair;
  let recipientKeypair: Keypair;
  let recipientAddress: string;

  // Connection
  let connection: Connection;

  // For tracking current state without relying on stdout
  let realmPubkey: PublicKey;
  let governancePubkey: PublicKey;
  let treasuryPubkey: PublicKey;
  let proposalPubkey: PublicKey;

  // Store initial balances for verification
  let initialRecipientBalance: number;

  /**
   * Helper function to retry operations with potential failures
   */
  async function retry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 5,
    delay: number = 2000
  ): Promise<T> {
    let lastError: Error;
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        console.log(
          `Retry ${i + 1}/${maxRetries} failed. Retrying in ${delay}ms...`
        );
        lastError = error as Error;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw lastError!;
  }

  /**
   * Helper to run CLI commands with retries
   */
  function runCliCommand(
    args: string[],
    maxRetries: number = 3
  ): { status: number; success: boolean; output: string } {
    let attempt = 0;
    let result;

    while (attempt < maxRetries) {
      result = spawnSync(CLI_CMD, [CLI_PATH, ...args], { encoding: "utf-8" });

      // Log the output for debugging
      console.log(`Command: ${CLI_CMD} ${CLI_PATH} ${args.join(" ")}`);
      console.log(`Output: ${result.stdout}`);
      console.log(`Error: ${result.stderr}`);

      if (result.status === 0) {
        return { status: 0, success: true, output: result.stdout };
      }
      attempt++;
      if (attempt < maxRetries) {
        console.log(
          `Command failed (attempt ${attempt}/${maxRetries}), retrying in 2 seconds...`
        );
        spawnSync("sleep", ["2"]);
      }
    }

    return {
      status: 1,
      success: false,
      output: result ? result.stderr : "Command failed",
    };
  }

  /**
   * Helper to find a realm by name
   */
  async function findRealmByName(name: string): Promise<PublicKey | null> {
    const splGovernance = new SplGovernance(
      connection,
      new PublicKey(SPL_GOVERNANCE_PROGRAM_ID)
    );
    const realms = await splGovernance.getAllRealms();
    const realm = realms.find((r) => r.name === name);
    return realm ? realm.publicKey : null;
  }

  /**
   * Helper to get governance account from realm
   */
  async function getGovernanceFromRealm(
    realmPubkey: PublicKey
  ): Promise<PublicKey> {
    const splGovernance = new SplGovernance(
      connection,
      new PublicKey(SPL_GOVERNANCE_PROGRAM_ID)
    );
    return splGovernance.pda.governanceAccount({
      realmAccount: realmPubkey,
      seed: realmPubkey,
    }).publicKey;
  }

  /**
   * Helper to get treasury account from governance
   */
  async function getTreasuryFromGovernance(
    governancePubkey: PublicKey
  ): Promise<PublicKey> {
    const splGovernance = new SplGovernance(
      connection,
      new PublicKey(SPL_GOVERNANCE_PROGRAM_ID)
    );
    return splGovernance.pda.nativeTreasuryAccount({
      governanceAccount: governancePubkey,
    }).publicKey;
  }

  /**
   * Helper to find the multisig associated with a realm
   * For standard DAO, this should return null
   */
  async function findMultisigForRealm(
    realmAddress: PublicKey
  ): Promise<PublicKey | null> {
    // This replicates the deterministic derivation from KeypairUtil.getRealmAssociatedMultisigAddress
    const [multisigPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("squad"), realmAddress.toBuffer(), Buffer.from("multisig")],
      new PublicKey(SQDS_PROGRAM_ID)
    );

    try {
      // Check if this multisig exists using getAccountInfo
      // We don't use fromAccountAddress because it would throw for non-existent accounts
      const accountInfo = await connection.getAccountInfo(multisigPda);
      return accountInfo ? multisigPda : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Helper to find a proposal by governance
   */
  async function findLatestProposal(
    governancePubkey: PublicKey
  ): Promise<PublicKey | null> {
    const splGovernance = new SplGovernance(
      connection,
      new PublicKey(SPL_GOVERNANCE_PROGRAM_ID)
    );
    const proposals = await splGovernance.getAllProposals();

    // Filter proposals for this specific governance and get the most recent one
    const governanceProposals = proposals
      .filter((p) => p.governance.equals(governancePubkey))
      .sort((a, b) => {
        // Sort by creation time, newest first
        if (a.votingAt && b.votingAt) {
          return b.votingAt.toNumber() - a.votingAt.toNumber();
        }
        return 0;
      });

    if (governanceProposals.length === 0) {
      console.log(
        "No proposals found for governance: " + governancePubkey.toBase58()
      );
      return null;
    }

    console.log(
      "Found proposal: " + governanceProposals[0].publicKey.toBase58()
    );
    return governanceProposals[0].publicKey;
  }

  /**
   * Check if a transfer was executed by verifying recipient balance
   */
  async function isTransferExecuted(
    recipientPubkey: PublicKey,
    expectedAmount: number
  ): Promise<boolean> {
    const balance = await connection.getBalance(recipientPubkey);
    return balance >= expectedAmount * LAMPORTS_PER_SOL * 0.9;
  }

  before(async function () {
    // Create clean test environment
    if (fs.existsSync(CONFIG_DIR)) {
      fs.removeSync(CONFIG_DIR);
    }
    fs.ensureDirSync(CONFIG_DIR);

    // Setup connection
    connection = new Connection("http://localhost:8899", "confirmed");

    // Create wallet for testing
    wallet = Keypair.generate();
    fs.writeJSONSync(WALLET_PATH, {
      keypair: Array.from(wallet.secretKey),
      pubkey: wallet.publicKey.toBase58(),
    });

    // Create recipient keypair for testing transfers
    recipientKeypair = Keypair.generate();
    recipientAddress = recipientKeypair.publicKey.toBase58();

    // Setup connection in config
    const config = {
      dao: {
        cluster: "localhost",
        endpoint: "http://localhost:8899",
      },
    };
    fs.writeJSONSync(CONFIG_PATH, config);

    // Airdrop to recipient to create account
    try {
      const airdropSig = await connection.requestAirdrop(
        recipientKeypair.publicKey,
        LAMPORTS_PER_SOL / 100
      );
      await connection.confirmTransaction(airdropSig);

      // Store initial balance
      initialRecipientBalance = await connection.getBalance(
        recipientKeypair.publicKey
      );
      console.log(
        `Initial recipient balance: ${
          initialRecipientBalance / LAMPORTS_PER_SOL
        } SOL`
      );
    } catch (error) {
      console.error("Failed to airdrop to recipient:", error);
    }

    // Airdrop to our wallet for tests - ensure enough SOL for transactions
    try {
      const airdropSig = await connection.requestAirdrop(
        wallet.publicKey,
        LAMPORTS_PER_SOL * 10
      );
      await connection.confirmTransaction(airdropSig);

      // Wait briefly for balance to update
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Verify balance
      const balance = await connection.getBalance(wallet.publicKey);
      expect(balance).to.be.at.least(LAMPORTS_PER_SOL * 5);
      console.log(`Wallet funded with ${balance / LAMPORTS_PER_SOL} SOL`);
    } catch (error) {
      console.error("Failed to fund wallet:", error);
      throw error;
    }
  });

  it("should initialize a standard DAO without Squads multisig", async function () {
    // Run the command
    const result = runCliCommand([
      "dao",
      "init",
      "--name",
      daoName,
      "--threshold",
      threshold.toString(),
      "--integrated",
      "false",
    ]);

    expect(result.success).to.be.true;

    // Find the realm we just created by name
    realmPubkey = await retry(async () => {
      const realm = await findRealmByName(daoName);
      expect(realm).to.not.be.null;
      return realm as PublicKey;
    });

    // Get the governance from realm
    governancePubkey = await getGovernanceFromRealm(realmPubkey);
    expect(governancePubkey).to.not.be.null;

    // Get treasury from governance
    treasuryPubkey = await getTreasuryFromGovernance(governancePubkey);
    expect(treasuryPubkey).to.not.be.null;

    // Verify the config file was updated with the realm
    const config = await ConfigService.getConfig();
    expect(config.dao?.activeRealm).to.equal(realmPubkey.toBase58());

    console.log("Standard DAO Addresses:");
    console.log(`Realm: ${realmPubkey.toBase58()}`);
    console.log(`Governance: ${governancePubkey.toBase58()}`);
    console.log(`Treasury: ${treasuryPubkey.toBase58()}`);
  });

  it("should verify the DAO creation on-chain", async function () {
    // Check realm existence and name
    const splGovernance = new SplGovernance(
      connection,
      new PublicKey(SPL_GOVERNANCE_PROGRAM_ID)
    );
    const realmInfo = await splGovernance.getRealmByPubkey(realmPubkey);
    expect(realmInfo.name).to.equal(daoName);

    // Verify this is NOT an integrated DAO (no multisig)
    const multisig = await findMultisigForRealm(realmPubkey);
    expect(multisig).to.be.null;

    // Verify the treasury exists
    const treasuryInfo = await connection.getAccountInfo(treasuryPubkey);
    expect(treasuryInfo).to.not.be.null;
  });

  it("should fund the treasury", async function () {
    // First check the initial treasury balance
    const initialBalance = await connection.getBalance(treasuryPubkey);
    console.log(
      `Initial treasury balance: ${initialBalance / LAMPORTS_PER_SOL} SOL`
    );

    // Run the fund command
    const result = runCliCommand([
      "dao",
      "fund",
      "--amount",
      fundAmount.toString(),
    ]);

    expect(result.success).to.be.true;
    console.log(`Fund command output: ${result.output}`);

    // Wait longer for the transaction to be processed
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Verify treasury was funded - use direct check rather than retry
    const balance = await connection.getBalance(treasuryPubkey);
    console.log(`New treasury balance: ${balance / LAMPORTS_PER_SOL} SOL`);

    // Check if balance increased by at least 0.9 * expected amount
    const expectedIncrease = fundAmount * LAMPORTS_PER_SOL * 0.9;
    const actualIncrease = balance - initialBalance;

    expect(actualIncrease).to.be.at.least(expectedIncrease);
  });

  it("should create a transfer proposal", async function () {
    const result = runCliCommand([
      "proposal",
      "transfer",
      "--amount",
      transferAmount.toString(),
      "--recipient",
      recipientAddress,
      "--name",
      "Test Standard Transfer",
    ]);

    expect(result.success).to.be.true;
    console.log(`Create proposal output: ${result.output}`);

    // Wait a bit for the proposal to be registered
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Find the proposal that was just created
    proposalPubkey = await retry(async () => {
      const proposal = await findLatestProposal(governancePubkey);
      expect(proposal).to.not.be.null;
      return proposal as PublicKey;
    });

    console.log(`Found proposal at: ${proposalPubkey.toBase58()}`);
  });

  it("should vote on the proposal", async function () {
    const result = runCliCommand([
      "proposal",
      "vote",
      "--proposal",
      proposalPubkey.toBase58(),
    ]);

    expect(result.success).to.be.true;
    console.log(`Vote output: ${result.output}`);

    // Wait for the vote to be processed
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Verify the vote was recorded - with better error handling
    await retry(async () => {
      const splGovernance = new SplGovernance(
        connection,
        new PublicKey(SPL_GOVERNANCE_PROGRAM_ID)
      );

      try {
        const proposal = await splGovernance.getProposalByPubkey(
          proposalPubkey
        );
        console.log(`Proposal state: ${JSON.stringify(proposal.state)}`);

        // Check if the proposal is in an appropriate state after voting
        const hasVoted = !proposal.state.draft && !proposal.state.signingOff;

        // Additional detailed logging for debugging
        if (!hasVoted) {
          console.log(
            `Unexpected proposal state: ${JSON.stringify(proposal.state)}`
          );
        }

        expect(hasVoted).to.be.true;
      } catch (error) {
        console.error("Error checking proposal state:", error);
        throw error;
      }
    });
  });

  it("should execute the proposal", async function () {
    const result = runCliCommand([
      "proposal",
      "execute",
      "--proposal",
      proposalPubkey.toBase58(),
    ]);

    expect(result.success).to.be.true;
    console.log(`Execute output: ${result.output}`);

    // Wait longer for execution to complete
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Verify the proposal execution - with better error handling
    await retry(
      async () => {
        const splGovernance = new SplGovernance(
          connection,
          new PublicKey(SPL_GOVERNANCE_PROGRAM_ID)
        );

        try {
          const proposal = await splGovernance.getProposalByPubkey(
            proposalPubkey
          );
          console.log(
            `Post-execution proposal state: ${JSON.stringify(proposal.state)}`
          );

          // Check if the proposal is now in executing or completed state
          // Fix: Check if the property exists, not if its value is true
          const isExecutingOrCompleted =
            proposal.state.executing !== undefined ||
            proposal.state.completed !== undefined;

          // Log the state for debugging
          if (!isExecutingOrCompleted) {
            console.log(
              `Proposal not executing/completed: ${JSON.stringify(
                proposal.state
              )}`
            );
          }

          expect(isExecutingOrCompleted).to.be.true;
        } catch (error) {
          console.error("Error checking execution state:", error);
          throw error;
        }
      },
      8,
      3000
    );
  });

  it("should verify the transfer was completed", async function () {
    // Wait longer for transfer to complete
    await new Promise((resolve) => setTimeout(resolve, 8000));

    // Get final recipient balance
    const finalRecipientBalance = await connection.getBalance(
      recipientKeypair.publicKey
    );
    console.log(
      `Final recipient balance: ${finalRecipientBalance / LAMPORTS_PER_SOL} SOL`
    );
    console.log(
      `Initial recipient balance was: ${
        initialRecipientBalance / LAMPORTS_PER_SOL
      } SOL`
    );
    console.log(`Expected increase: ${transferAmount} SOL`);

    // Calculate the actual balance increase
    const balanceIncrease = finalRecipientBalance - initialRecipientBalance;
    console.log(
      `Actual balance increase: ${balanceIncrease / LAMPORTS_PER_SOL} SOL`
    );

    // Verify transfer - using increased balance rather than absolute amount
    expect(balanceIncrease).to.be.at.least(
      transferAmount * LAMPORTS_PER_SOL * 0.9
    );

    // Check treasury balance has decreased
    const treasuryBalance = await connection.getBalance(treasuryPubkey);
    console.log(
      `Treasury balance after transfer: ${
        treasuryBalance / LAMPORTS_PER_SOL
      } SOL`
    );
  });

  it("should verify this is a standard DAO without multisig integration", async function () {
    // Use our helper to confirm this is NOT an integrated DAO
    const multisig = await findMultisigForRealm(realmPubkey);
    expect(multisig).to.be.null;

    // Additional verification - check that the CLI command runs without error
    const result = runCliCommand(["dao", "show"]);
    expect(result.success).to.be.true;
  });
});
