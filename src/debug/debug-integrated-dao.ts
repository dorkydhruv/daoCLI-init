import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { GovernanceService } from "../services/governance-service";
import { ProposalService } from "../services/proposal-service";
import { MultisigService } from "../services/multisig-service";
import { ConnectionService } from "../services/connection-service";
import { WalletService } from "../services/wallet-service";
import * as multisig from "@sqds/multisig";
import { SplGovernance } from "governance-idl-sdk";
import { SPL_GOVERNANCE_PROGRAM_ID } from "../utils/constants";

/**
 * Debug script for testing the integrated DAO with Squads multisig
 */
async function debugIntegratedDao() {
  console.log("\n=================================================");
  console.log("     INTEGRATED DAO WITH SQUADS MULTISIG TEST     ");
  console.log("=================================================\n");

  // 1. Setup connection and wallet
  try {
    console.log("Setting up connection and wallet...");
    const connectionRes = await ConnectionService.getConnection();
    if (!connectionRes.success || !connectionRes.data) {
      console.log("Failed to establish connection");
      return;
    }
    const connection = connectionRes.data;

    const walletRes = await WalletService.loadWallet();
    if (!walletRes.success || !walletRes.data) {
      console.log("No wallet configured. Please run 'wallet create' first");
      return;
    }
    const keypair = WalletService.getKeypair(walletRes.data);

    console.log(`Using wallet: ${keypair.publicKey.toBase58()}`);

    // Check balance
    const balance = await connection.getBalance(keypair.publicKey);
    console.log(`Wallet balance: ${balance / 1e9} SOL`);

    if (balance < 1e9) {
      throw new Error(
        "Insufficient balance for testing. Please fund your wallet with at least 1 SOL."
      );
    }

    // 2. Create DAO with integrated multisig
    console.log("\n----- STEP 1: Creating integrated DAO -----");
    const daoName = `Integrated-Debug-${Math.floor(Math.random() * 10000)}`;
    const members = [keypair.publicKey];
    const threshold = 1;

    console.log(`DAO Name: ${daoName}`);
    console.log(`Members: ${members.map((m) => m.toBase58()).join(", ")}`);
    console.log(`Threshold: ${threshold}`);

    const daoResult = await GovernanceService.initializeDAO(
      connection,
      keypair,
      daoName,
      members,
      threshold
    );

    if (!daoResult.success || !daoResult.data) {
      console.log("Failed to initialize DAO:", daoResult.error?.message);
      return;
    }

    const { realmAddress, governanceAddress, treasuryAddress } = daoResult.data;

    console.log(`\nDAO created successfully!`);
    console.log(`Realm: ${realmAddress.toBase58()}`);
    console.log(`Governance: ${governanceAddress.toBase58()}`);
    console.log(`Treasury: ${treasuryAddress.toBase58()}`);

    // Create the Squads multisig connected to this DAO
    console.log("\n----- STEP 2: Creating Squads multisig -----");

    const multisigResult = await MultisigService.createDaoControlledMultisig(
      connection,
      keypair,
      threshold,
      members,
      `${daoName}-multisig`,
      realmAddress
    );

    if (!multisigResult.success || !multisigResult.data) {
      console.log("Failed to create multisig:", multisigResult.error?.message);
      return;
    }

    const { multisigPda } = multisigResult.data;
    console.log(`\nSquads multisig created successfully!`);
    console.log(`Multisig: ${multisigPda.toBase58()}`);

    // Get the vault PDA
    const vaultPdaRes = MultisigService.getMultisigVaultPda(multisigPda);
    if (!vaultPdaRes.success || !vaultPdaRes.data) {
      console.log("Failed to get vault address:", vaultPdaRes.error?.message);
      return;
    }
    const vaultPda = vaultPdaRes.data;
    console.log(`Vault: ${vaultPda.toBase58()}`);

    // 3. Fund both treasury and multisig vault
    console.log("\n----- STEP 3: Funding treasury and multisig vault -----");

    // Fund treasury
    console.log(`Funding treasury with 0.2 SOL...`);
    const treasuryFundRes = await GovernanceService.fundTreasury(
      connection,
      keypair,
      treasuryAddress,
      0.2
    );

    if (!treasuryFundRes.success) {
      console.log("Failed to fund treasury:", treasuryFundRes.error?.message);
      return;
    }

    // Fund multisig vault
    console.log(`Funding multisig vault with 0.2 SOL...`);
    const vaultFundRes = await GovernanceService.fundTreasury(
      connection,
      keypair,
      vaultPda,
      0.2
    );

    if (!vaultFundRes.success) {
      console.log("Failed to fund vault:", vaultFundRes.error?.message);
      return;
    }

    // Verify balances
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const treasuryBalance = await connection.getBalance(treasuryAddress);
    const vaultBalance = await connection.getBalance(vaultPda);

    console.log(`\nTreasury balance: ${treasuryBalance / 1e9} SOL`);
    console.log(`Vault balance: ${vaultBalance / 1e9} SOL`);

    // 4. Create a test recipient
    const recipient = Keypair.generate().publicKey;
    const transferAmount = 0.05;
    console.log(`\nRecipient for test transfer: ${recipient.toBase58()}`);

    // 5. Create integrated proposal
    console.log("\n----- STEP 4: Creating integrated proposal -----");

    // Create transfer instruction for the multisig
    const transferInstructionRes =
      await ProposalService.getSquadsMultisigSolTransferInstruction(
        connection,
        multisigPda,
        transferAmount,
        recipient
      );

    if (!transferInstructionRes.success || !transferInstructionRes.data) {
      console.log(
        "Failed to create transfer instruction:",
        transferInstructionRes.error?.message
      );
      return;
    }

    console.log("Transfer instruction created successfully!");

    // Create the integrated proposal
    const proposalTitle = "Debug Integrated Transfer";
    const proposalDescription = `Transfer ${transferAmount} SOL from multisig vault to ${recipient.toBase58()}`;

    const proposalRes =
      await ProposalService.createIntegratedAssetTransferProposal(
        connection,
        keypair,
        realmAddress,
        proposalTitle,
        proposalDescription,
        [transferInstructionRes.data]
      );

    if (!proposalRes.success || !proposalRes.data) {
      console.log("Failed to create proposal:", proposalRes.error?.message);
      return;
    }

    const proposalAddress = proposalRes.data;
    console.log(`\nIntegrated proposal created: ${proposalAddress.toBase58()}`);

    // 6. Vote on the proposal
    console.log("\n----- STEP 5: Voting on proposal -----");
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const voteRes = await ProposalService.castVote(
      connection,
      keypair,
      realmAddress,
      proposalAddress,
      true
    );

    if (!voteRes.success) {
      console.log("Failed to cast vote:", voteRes.error?.message);
      return;
    }

    console.log("Vote cast successfully!");

    // 8. Verify transfer
    console.log("\n----- STEP 7: Verifying transfer -----");
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Get proposal details to extract multisig info
    const splGovernance = new SplGovernance(
      connection,
      new PublicKey(SPL_GOVERNANCE_PROGRAM_ID)
    );

    const proposal = await splGovernance.getProposalByPubkey(proposalAddress);
    // @ts-ignore: Accessing private static method
    const multisigInfo = ProposalService["extractMultisigInfo"](
      proposal.descriptionLink
    );

    console.log("\nMultisig transaction info from proposal:");
    console.log(
      `Multisig Address: ${
        multisigInfo.multisigAddress?.toBase58() || "Not found"
      }`
    );
    console.log(
      `Transaction Index: ${multisigInfo.transactionIndex || "Not found"}`
    );

    // Check recipient balance
    const recipientBalance = await connection.getBalance(recipient);
    console.log(`\nRecipient balance: ${recipientBalance / 1e9} SOL`);

    if (recipientBalance >= transferAmount * 1e9 * 0.9) {
      console.log("\n✅ TEST PASSED: Transfer completed successfully!");
    } else {
      console.log("\n⚠️ TEST INCOMPLETE: Transfer not completed yet");

      // Try manual execution if needed
      if (multisigInfo.multisigAddress && multisigInfo.transactionIndex) {
        console.log("Attempting manual multisig transaction execution...");

        try {
          const executeRes = await MultisigService.executeMultisigTransaction(
            connection,
            keypair,
            multisigInfo.multisigAddress,
            multisigInfo.transactionIndex
          );

          if (!executeRes.success) {
            console.log(
              "Failed to execute multisig transaction:",
              executeRes.error?.message
            );
          }

          // Check balance again after manual execution
          await new Promise((resolve) => setTimeout(resolve, 3000));
          const finalBalance = await connection.getBalance(recipient);
          console.log(
            `Recipient balance after manual execution: ${
              finalBalance / 1e9
            } SOL`
          );

          if (finalBalance >= transferAmount * 1e9 * 0.9) {
            console.log(
              "\n✅ TEST PASSED: Transfer completed after manual execution!"
            );
          } else {
            console.log(
              "\n❌ TEST FAILED: Transfer did not complete even after manual execution"
            );
          }
        } catch (error) {
          console.error("Manual execution failed:", error);
        }
      }
    }

    console.log("\n=================================================");
    console.log("        INTEGRATED DAO TEST COMPLETED              ");
    console.log("=================================================\n");
  } catch (error) {
    console.error("Test failed with error:", error);
  }
}

debugIntegratedDao().catch(console.error);
