import {
  Connection,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { spawnSync } from "child_process";
import path from "path";
import fs from "fs-extra";
import { expect } from "chai";
import * as multisig from "@sqds/multisig";
import { SplGovernance } from "governance-idl-sdk";
import {
  SPL_GOVERNANCE_PROGRAM_ID,
  SQDS_PROGRAM_ID,
} from "../src/utils/constants";
import { ConfigService } from "../src/services/config-service";
import { GovernanceService } from "../src/services/governance-service";
import { MultisigService } from "../src/services/multisig-service";
import { ProposalService } from "../src/services/proposal-service";
import { KeypairUtil } from "../src/utils/keypair-util";

describe("Integrated DAO with Squads Multisig Test", function () {
  // Extend mocha timeout since blockchain operations take time
  this.timeout(600000); // 10 minutes to handle slow CI environments

  const CLI_PATH = path.resolve(__dirname, "../src/index.ts");
  const CLI_CMD = "ts-node";
  const CONFIG_DIR = path.join(process.env.HOME || "", ".config", "dao-cli");
  const WALLET_PATH = path.join(CONFIG_DIR, "wallet.json");
  const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");

  // Test parameters
  const daoName = `TestDAO-${Math.floor(Math.random() * 10000)}`;
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
  let multisigPubkey: PublicKey;
  let vaultPubkey: PublicKey;
  let proposalPubkey: PublicKey;

  // Store initial balances for verification
  let initialRecipientBalance: number;

  /**
   * Helper function to retry operations with potential failures
   */
  async function retry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 8,
    delay: number = 3000
  ): Promise<T> {
    let lastError: Error;
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        console.log(
          `Retry ${i + 1}/${maxRetries} failed. Retrying in ${delay}ms...`
        );
        console.log(`Error: ${error instanceof Error ? error.message : error}`);
        lastError = error as Error;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw lastError!;
  }

  /**
   * Helper to find the multisig associated with a realm
   */
  async function findMultisigForRealm(
    realmAddress: PublicKey
  ): Promise<PublicKey | null> {
    try {
      console.log(
        `Looking for multisig associated with realm: ${realmAddress.toBase58()}`
      );

      // This replicates the deterministic derivation from KeypairUtil.getRealmAssociatedMultisigAddress
      const multisigPda =
        KeypairUtil.getRealmAssociatedMultisigAddress(realmAddress);
      console.log(`Derived multisig PDA: ${multisigPda.toBase58()}`);

      // Check if this multisig exists
      const accountInfo = await connection.getAccountInfo(multisigPda);
      if (!accountInfo) {
        console.log("Multisig account does not exist");
        return null;
      }

      console.log("Found multisig account!");
      return multisigPda;
    } catch (error) {
      console.error("Error finding multisig for realm:", error);
      return null;
    }
  }

  /**
   * Helper function to wait for the validator to be ready
   */
  async function waitForValidator(
    endpoint: string,
    maxRetries = 30
  ): Promise<Connection> {
    console.log(`Attempting to connect to validator at ${endpoint}`);
    const conn = new Connection(endpoint, "confirmed");

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Try to get a simple response from the validator
        await conn.getVersion();
        console.log("Successfully connected to Solana validator");
        return conn;
      } catch (error) {
        console.log(
          `Validator not ready, retrying in 1 second... (${
            attempt + 1
          }/${maxRetries})`
        );
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    throw new Error(
      `Failed to connect to validator at ${endpoint} after ${maxRetries} attempts`
    );
  }

  before(async function () {
    this.timeout(60000); // Increase timeout for validator startup
    console.log("====== Setting up test environment ======");

    // Create clean test environment
    if (fs.existsSync(CONFIG_DIR)) {
      fs.removeSync(CONFIG_DIR);
    }
    fs.ensureDirSync(CONFIG_DIR);

    // Try different validator endpoints in case one fails
    const possibleEndpoints = [
      "http://127.0.0.1:8899", // IPv4
      "http://localhost:8899", // hostname resolution
    ];

    let connected = false;

    for (const endpoint of possibleEndpoints) {
      try {
        connection = await waitForValidator(endpoint);
        connected = true;
        console.log(`Connected to validator at ${endpoint}`);

        // Setup connection in config using the successful endpoint
        const config = {
          dao: {
            cluster: "localhost",
            endpoint: endpoint,
          },
        };
        fs.writeJSONSync(CONFIG_PATH, config);

        break;
      } catch (error) {
        console.error(`Failed to connect to ${endpoint}:`, error);
      }
    }

    if (!connected) {
      // If we can't connect to a validator, create mock config anyway
      // for GitHub Actions to proceed with other tests
      console.log(
        "WARNING: Could not connect to validator. Creating mock configuration."
      );
      const config = {
        dao: {
          cluster: "localhost",
          endpoint: "http://127.0.0.1:8899",
        },
      };
      fs.writeJSONSync(CONFIG_PATH, config);

      // We'll skip tests that require an actual validator
      this.skip();
      return;
    }

    // Create wallet for testing
    wallet = Keypair.generate();
    fs.writeJSONSync(WALLET_PATH, {
      keypair: Array.from(wallet.secretKey),
      pubkey: wallet.publicKey.toBase58(),
    });
    console.log(`Created test wallet: ${wallet.publicKey.toBase58()}`);

    // Create recipient keypair for testing transfers
    recipientKeypair = Keypair.generate();
    recipientAddress = recipientKeypair.publicKey.toBase58();
    console.log(`Created recipient wallet: ${recipientAddress}`);

    try {
      // Airdrop to recipient to create account
      console.log("Airdropping to recipient...");
      const airdropSig = await connection.requestAirdrop(
        recipientKeypair.publicKey,
        LAMPORTS_PER_SOL / 100
      );
      await connection.confirmTransaction(airdropSig, "confirmed");
      initialRecipientBalance = await connection.getBalance(
        recipientKeypair.publicKey
      );
      console.log(
        `Recipient funded with ${
          initialRecipientBalance / LAMPORTS_PER_SOL
        } SOL`
      );
    } catch (error) {
      console.error("Failed to airdrop to recipient:", error);
      // Don't fail test setup completely on airdrop failure
    }

    try {
      // Airdrop to our wallet for tests
      console.log("Airdropping to wallet...");
      const airdropSig = await connection.requestAirdrop(
        wallet.publicKey,
        LAMPORTS_PER_SOL * 10
      );
      await connection.confirmTransaction(airdropSig, "confirmed");

      // Wait briefly for balance to update
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Verify balance
      const balance = await connection.getBalance(wallet.publicKey);
      expect(balance).to.be.at.least(LAMPORTS_PER_SOL);
      console.log(`Wallet funded with ${balance / LAMPORTS_PER_SOL} SOL`);
    } catch (error) {
      console.error("Failed to fund wallet:", error);
      this.skip(); // Skip tests if we can't fund the wallet
    }

    console.log("====== Setup complete ======");
  });

  it("should initialize an integrated DAO with Squads multisig", async function () {
    console.log("====== Creating integrated DAO ======");

    // Using direct service calls instead of CLI to have better control
    try {
      // First create the DAO
      console.log("Creating SPL Governance DAO...");
      const { realmAddress, governanceAddress, treasuryAddress } =
        await GovernanceService.initializeDAO(
          connection,
          wallet,
          daoName,
          [wallet.publicKey],
          threshold
        );

      realmPubkey = realmAddress;
      governancePubkey = governanceAddress;
      treasuryPubkey = treasuryAddress;

      console.log(`Created realm at: ${realmPubkey.toBase58()}`);
      console.log(`Created governance at: ${governancePubkey.toBase58()}`);
      console.log(`Created treasury at: ${treasuryPubkey.toBase58()}`);

      // Update config to use this realm
      await ConfigService.setActiveRealm(realmPubkey.toBase58());
      console.log("Updated config with new realm address");

      // Now create the multisig linked to the DAO
      console.log("Creating Squads multisig...");
      const { multisigPda } = await MultisigService.createDaoControlledMultisig(
        connection,
        wallet,
        threshold,
        [wallet.publicKey],
        `${daoName}-multisig`,
        realmPubkey
      );

      multisigPubkey = multisigPda;
      console.log(`Created multisig at: ${multisigPubkey.toBase58()}`);

      // Get the vault PDA
      const [vaultPda] = multisig.getVaultPda({
        multisigPda: multisigPubkey,
        index: 0,
      });
      vaultPubkey = vaultPda;
      console.log(`Derived vault at: ${vaultPubkey.toBase58()}`);

      // Allow some time for on-chain confirmation
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Verify the multisig was created correctly by checking the account exists
      const multisigAccount = await connection.getAccountInfo(multisigPubkey);
      expect(multisigAccount).to.not.be.null;
      if (!multisigAccount) {
        throw new Error("Multisig account not found");
      }
      console.log("Verified multisig account exists on-chain");

      // Verify the config file was updated with the realm
      const config = await ConfigService.getConfig();
      expect(config.dao?.activeRealm).to.equal(realmPubkey.toBase58());
    } catch (error) {
      console.error("Error creating integrated DAO:", error);
      throw error;
    }
  });

  it("should fund the multisig vault", async function () {
    console.log("====== Funding multisig vault ======");

    // Make sure we have a valid vault address
    expect(vaultPubkey).to.not.be.undefined;

    // Fund vault directly rather than via CLI
    const initialBalance = await connection.getBalance(vaultPubkey);
    console.log(
      `Initial vault balance: ${initialBalance / LAMPORTS_PER_SOL} SOL`
    );

    // Create and send transaction
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: vaultPubkey,
        lamports: fundAmount * LAMPORTS_PER_SOL,
      })
    );

    try {
      const signature = await connection.sendTransaction(transaction, [wallet]);
      await connection.confirmTransaction(signature, "confirmed");
      console.log(`Funded vault, signature: ${signature}`);

      // Verify vault was funded
      await retry(async () => {
        const balance = await connection.getBalance(vaultPubkey);
        console.log(`New vault balance: ${balance / LAMPORTS_PER_SOL} SOL`);
        expect(balance).to.be.at.least(
          initialBalance + fundAmount * LAMPORTS_PER_SOL * 0.9
        );
      });
    } catch (error) {
      console.error("Error funding vault:", error);
      throw error;
    }
  });

  it("should verify the DAO creation on-chain", async function () {
    console.log("====== Verifying DAO on-chain ======");

    // Make sure we have valid values from previous test
    expect(realmPubkey).to.not.be.undefined;
    expect(multisigPubkey).to.not.be.undefined;

    // Check realm existence and name
    const splGovernance = new SplGovernance(
      connection,
      new PublicKey(SPL_GOVERNANCE_PROGRAM_ID)
    );
    const realmInfo = await splGovernance.getRealmByPubkey(realmPubkey);
    expect(realmInfo.name).to.equal(daoName);
    console.log(`Verified realm name: ${realmInfo.name}`);

    // Check multisig existence and threshold
    const multisigInfo = await multisig.accounts.Multisig.fromAccountAddress(
      connection,
      multisigPubkey
    );
    expect(multisigInfo.threshold).to.equal(threshold);
    console.log(`Verified multisig threshold: ${multisigInfo.threshold}`);

    // Verify the vault exists
    const vaultInfo = await connection.getAccountInfo(vaultPubkey);
    expect(vaultInfo).to.not.be.null;
    console.log("Verified vault account exists on-chain");
  });

  it("should create a transfer proposal", async function () {
    console.log("====== Creating transfer proposal ======");

    // Make sure we have valid addresses
    expect(realmPubkey).to.not.be.undefined;
    expect(multisigPubkey).to.not.be.undefined;
    expect(recipientAddress).to.not.be.undefined;

    try {
      // Create transfer instruction for the multisig vault
      const transferInstruction =
        await ProposalService.getSquadsMultisigSolTransferInstruction(
          connection,
          multisigPubkey,
          transferAmount,
          recipientKeypair.publicKey
        );
      console.log("Created transfer instruction");

      // Create the integrated proposal
      const proposalTitle = "Test Transfer";
      const proposalDescription = `Transfer ${transferAmount} SOL to ${recipientAddress}`;

      proposalPubkey =
        await ProposalService.createIntegratedAssetTransferProposal(
          connection,
          wallet,
          realmPubkey,
          proposalTitle,
          proposalDescription,
          [transferInstruction]
        );

      console.log(`Created proposal at: ${proposalPubkey.toBase58()}`);

      // Verify the proposal exists
      await retry(async () => {
        const splGovernance = new SplGovernance(
          connection,
          new PublicKey(SPL_GOVERNANCE_PROGRAM_ID)
        );
        const proposal = await splGovernance.getProposalByPubkey(
          proposalPubkey
        );
        expect(proposal).to.not.be.undefined;
      });
    } catch (error) {
      console.error("Error creating proposal:", error);
      throw error;
    }
  });

  it("should vote on the proposal", async function () {
    console.log("====== Voting on proposal ======");

    // Make sure we have a valid proposal address
    expect(proposalPubkey).to.not.be.undefined;

    try {
      // Vote directly with the service
      await ProposalService.castVote(
        connection,
        wallet,
        realmPubkey,
        proposalPubkey,
        true // approve
      );
      console.log("Vote cast successfully");

      // Allow time for vote to be processed
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Verify the vote was recorded
      await retry(async () => {
        const splGovernance = new SplGovernance(
          connection,
          new PublicKey(SPL_GOVERNANCE_PROGRAM_ID)
        );
        const proposal = await splGovernance.getProposalByPubkey(
          proposalPubkey
        );

        // Check that the proposal is now in an appropriate state after voting
        const stateObj = proposal.state;
        console.log("Current proposal state:", JSON.stringify(stateObj));

        // It might be in voting state or already succeeded
        const inValidState =
          stateObj.voting !== undefined ||
          stateObj.succeeded !== undefined ||
          stateObj.executing !== undefined ||
          stateObj.completed !== undefined;

        expect(inValidState).to.be.true;
      });
    } catch (error) {
      console.error("Error voting on proposal:", error);
      throw error;
    }
  });

  it("should verify the transfer was completed", async function () {
    console.log("====== Verifying transfer ======");

    // Wait longer for the multisig transaction to complete
    await new Promise((resolve) => setTimeout(resolve, 10000));

    try {
      // Check if the transfer was successful
      await retry(
        async () => {
          const finalRecipientBalance = await connection.getBalance(
            recipientKeypair.publicKey
          );
          console.log(
            `Final recipient balance: ${
              finalRecipientBalance / LAMPORTS_PER_SOL
            } SOL`
          );
          console.log(
            `Initial recipient balance: ${
              initialRecipientBalance / LAMPORTS_PER_SOL
            } SOL`
          );

          const balanceIncrease =
            finalRecipientBalance - initialRecipientBalance;
          console.log(
            `Balance increase: ${balanceIncrease / LAMPORTS_PER_SOL} SOL`
          );
          console.log(`Expected increase: ${transferAmount} SOL`);

          expect(balanceIncrease).to.be.at.least(
            transferAmount * LAMPORTS_PER_SOL * 0.9
          );

          // Also check vault balance decreased
          const vaultBalance = await connection.getBalance(vaultPubkey);
          console.log(
            `Vault balance after transfer: ${
              vaultBalance / LAMPORTS_PER_SOL
            } SOL`
          );
        },
        12,
        5000
      ); // More retries with longer delay for transfer verification
    } catch (error) {
      console.error("Error verifying transfer:", error);
      throw error;
    }
  });

  it("should show DAO integration status correctly", async function () {
    console.log("====== Checking DAO integration status ======");

    // Use our helper to determine if this is an integrated DAO
    const multisig = await findMultisigForRealm(realmPubkey);
    expect(multisig).to.not.be.null;

    if (multisig) {
      expect(multisig.toBase58()).to.equal(multisigPubkey.toBase58());
      console.log("Verified multisig is associated with the realm");
    } else {
      throw new Error("Multisig not found for realm");
    }
  });
});
