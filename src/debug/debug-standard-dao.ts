import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { GovernanceService } from "../services/governance-service";
import { ProposalService } from "../services/proposal-service";
import { ConnectionService } from "../services/connection-service";
import { WalletService } from "../services/wallet-service";
import { SplGovernance } from "governance-idl-sdk";
import { SPL_GOVERNANCE_PROGRAM_ID } from "../utils/constants";

/**
 * Debug script for testing a standard DAO (without Squads multisig integration)
 *
 * This tests:
 * 1. Creating a standard DAO
 * 2. Funding the DAO treasury
 * 3. Creating a proposal
 * 4. Voting and executing the proposal
 */
async function debugStandardDao() {
  console.log("\n=================================================");
  console.log("               STANDARD DAO TEST                  ");
  console.log("=================================================\n");

  // 1. Setup connection and wallet
  try {
    console.log("Setting up connection and wallet...");
    const connection = await ConnectionService.getConnection();
    const wallet = await WalletService.loadWallet();

    if (!wallet) {
      throw new Error("No wallet configured. Please run 'wallet create' first");
    }

    const keypair = WalletService.getKeypair(wallet);
    console.log(`Using wallet: ${keypair.publicKey.toBase58()}`);

    // Check balance
    const balance = await connection.getBalance(keypair.publicKey);
    console.log(`Wallet balance: ${balance / 1e9} SOL`);

    if (balance < 1e9) {
      throw new Error(
        "Insufficient balance for testing. Please fund your wallet with at least 1 SOL."
      );
    }

    // 2. Create standard DAO (without Squads integration)
    console.log("\n----- STEP 1: Creating standard DAO -----");
    const daoName = `Standard-Debug-${Math.floor(Math.random() * 10000)}`;
    const members = [keypair.publicKey];
    const threshold = 1;

    console.log(`DAO Name: ${daoName}`);
    console.log(`Members: ${members.map((m) => m.toBase58()).join(", ")}`);
    console.log(`Threshold: ${threshold}`);

    const { realmAddress, governanceAddress, treasuryAddress } =
      await GovernanceService.initializeDAO(
        connection,
        keypair,
        daoName,
        members,
        threshold
      );

    console.log(`\nDAO created successfully!`);
    console.log(`Realm: ${realmAddress.toBase58()}`);
    console.log(`Governance: ${governanceAddress.toBase58()}`);
    console.log(`Treasury: ${treasuryAddress.toBase58()}`);

    // 3. Fund the treasury
    console.log("\n----- STEP 2: Funding treasury -----");

    console.log(`Funding treasury with 0.2 SOL...`);
    await ProposalService.fundTreasury(
      connection,
      keypair,
      treasuryAddress,
      0.2
    );

    // Verify balance
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const treasuryBalance = await connection.getBalance(treasuryAddress);
    console.log(`\nTreasury balance: ${treasuryBalance / 1e9} SOL`);

    // 4. Create a test recipient
    const recipient = Keypair.generate().publicKey;
    const transferAmount = 0.05;
    console.log(`\nRecipient for test transfer: ${recipient.toBase58()}`);

    // 5. Create proposal
    console.log("\n----- STEP 3: Creating transfer proposal -----");

    // Create transfer instruction
    const transferInstruction = await ProposalService.getSolTransferInstruction(
      connection,
      realmAddress,
      transferAmount,
      recipient
    );

    // Create the proposal
    const proposalTitle = "Debug Standard Transfer";
    const proposalDescription = `Transfer ${transferAmount} SOL from treasury to ${recipient.toBase58()}`;

    const proposalAddress = await ProposalService.createProposal(
      connection,
      keypair,
      realmAddress,
      proposalTitle,
      proposalDescription,
      [transferInstruction]
    );

    console.log(`\nProposal created: ${proposalAddress.toBase58()}`);

    // 6. Vote on the proposal
    console.log("\n----- STEP 4: Voting on proposal -----");
    await new Promise((resolve) => setTimeout(resolve, 2000));

    await ProposalService.castVote(
      connection,
      keypair,
      realmAddress,
      proposalAddress,
      true
    );

    console.log("Vote cast successfully!");

    // 7. Execute the proposal
    console.log("\n----- STEP 5: Executing proposal -----");
    await new Promise((resolve) => setTimeout(resolve, 2000));

    await ProposalService.executeProposal(connection, keypair, proposalAddress);

    console.log("Proposal executed successfully!");

    // 8. Verify transfer
    console.log("\n----- STEP 6: Verifying transfer -----");
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Check recipient balance
    const recipientBalance = await connection.getBalance(recipient);
    console.log(`\nRecipient balance: ${recipientBalance / 1e9} SOL`);

    if (recipientBalance >= transferAmount * 1e9 * 0.9) {
      console.log("\n✅ TEST PASSED: Transfer completed successfully!");
    } else {
      console.log("\n❌ TEST FAILED: Transfer did not complete");

      // Check proposal status
      try {
        const splGovernance = new SplGovernance(
          connection,
          new PublicKey(SPL_GOVERNANCE_PROGRAM_ID)
        );

        const proposal = await splGovernance.getProposalByPubkey(
          proposalAddress
        );
        console.log(`\nProposal state: ${JSON.stringify(proposal.state)}`);

        // Check if the transaction was executed
        const proposalTxPda = splGovernance.pda.proposalTransactionAccount({
          proposal: proposalAddress,
          optionIndex: 0,
          index: 0,
        }).publicKey;

        const proposalTx = await splGovernance.getProposalTransactionByPubkey(
          proposalTxPda
        );
        console.log(`Transaction executed: ${proposalTx.executedAt !== null}`);
      } catch (error) {
        console.error("Error checking proposal status:", error);
      }
    }

    console.log("\n=================================================");
    console.log("          STANDARD DAO TEST COMPLETED             ");
    console.log("=================================================\n");
  } catch (error) {
    console.error("Test failed with error:", error);
  }
}

debugStandardDao().catch(console.error);
