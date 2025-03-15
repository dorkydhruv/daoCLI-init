import { Connection, Keypair, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { GovernanceService } from "../services/governance-service";
import { ProposalService } from "../services/proposal-service";
import { MultisigService } from "../services/multisig-service";
import { ConnectionService } from "../services/connection-service";
import { WalletService } from "../services/wallet-service";
import { KeypairUtil } from "../utils/keypair-util";
import * as multisig from "@sqds/multisig";
import { SplGovernance } from "governance-idl-sdk";
import { SPL_GOVERNANCE_PROGRAM_ID } from "../utils/constants";

/**
 * This script demonstrates the fully integrated workflow:
 * 1. Create a DAO with integrated multisig (deterministically derived from realm address)
 * 2. Fund the multisig vault
 * 3. Create an integrated proposal for a transfer
 * 4. Vote/approve, which automatically executes the multisig transaction if threshold is met
 */
async function runIntegratedTest() {
  console.log("========== RUNNING INTEGRATED DAO-MULTISIG TEST ==========");

  // Setup connection
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
    console.log(
      "Insufficient balance for testing. Please fund this devnet address."
    );
    console.log(
      `You can request a devnet airdrop using: solana airdrop 2 ${keypair.publicKey.toBase58()} --url devnet`
    );
    return;
  }

  try {
    // Step 1: Create DAO with integrated multisig
    console.log("\n=== STEP 1: Creating integrated DAO ===");
    const daoName = `test-dao-${Math.floor(Math.random() * 10000)}`;

    // For simpler testing, we'll use a single member with threshold 1
    const members = [keypair.publicKey];
    const threshold = 1;

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

    console.log(`DAO created with realm: ${realmAddress.toBase58()}`);
    console.log(`Governance: ${governanceAddress.toBase58()}`);
    console.log(`Treasury: ${treasuryAddress.toBase58()}`);

    // Pre-calculate what our multisig address will be
    const expectedMultisigAddress=
      KeypairUtil.getRealmAssociatedMultisigAddress(realmAddress);
    console.log(`Expected multisig: ${expectedMultisigAddress.toBase58()}`);

    // Wait for accounts to finalize
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Step 2: Create integrated multisig using the derived realm key
    console.log("\n=== STEP 2: Creating integrated multisig ===");

    // We only need the realm address now to deterministically generate the multisig
    const multisigResult = await MultisigService.createDaoControlledMultisig(
      connection,
      keypair,
      threshold,
      members,
      `${daoName}-multisig`,
      realmAddress // Now using realmAddress instead of treasuryAddress
    );

    if (!multisigResult.success || !multisigResult.data) {
      console.log("Failed to create multisig:", multisigResult.error?.message);
      return;
    }

    const { multisigPda } = multisigResult.data;
    console.log(`Squads multisig created: ${multisigPda.toBase58()}`);

    // Verify the multisig address matches our expected address
    if (multisigPda.toBase58() !== expectedMultisigAddress.toBase58()) {
      console.log(
        `WARNING: Multisig address doesn't match expected! This may indicate a deterministic derivation issue.`
      );
    }

    // Step 3: Fund the multisig vault
    console.log("\n=== STEP 3: Funding multisig vault ===");

    // Get vault PDA
    const vaultPdaRes = MultisigService.getMultisigVaultPda(multisigPda);
    if (!vaultPdaRes.success || !vaultPdaRes.data) {
      console.log("Failed to get vault address:", vaultPdaRes.error?.message);
      return;
    }
    const vaultPda = vaultPdaRes.data;
    console.log(`Vault PDA: ${vaultPda.toBase58()}`);

    // Fund the vault
    const fundAmount = 0.2;
    const fundResult = await GovernanceService.fundTreasury(
      connection,
      keypair,
      vaultPda,
      fundAmount
    );

    if (!fundResult.success) {
      console.log("Failed to fund vault:", fundResult.error?.message);
      return;
    }

    // Verify vault was funded with retry logic
    let vaultBalance = 0;
    let retries = 5;
    while (retries > 0) {
      vaultBalance = await connection.getBalance(vaultPda);
      console.log(`Vault balance: ${vaultBalance / 1e9} SOL`);

      if (vaultBalance >= fundAmount * 1e9 * 0.9) break; // Success

      console.log(
        `Waiting for vault funding to complete... (${retries} retries left)`
      );
      await new Promise((resolve) => setTimeout(resolve, 2000));
      retries--;
    }

    if (vaultBalance < fundAmount * 1e9 * 0.9) {
      throw new Error("Vault funding failed or has insufficient balance");
    }

    console.log(`Vault funded successfully with ${vaultBalance / 1e9} SOL`);

    // Step 4: Create an integrated proposal
    console.log("\n=== STEP 4: Creating integrated proposal ===");

    // Generate a random recipient
    const recipient = Keypair.generate().publicKey;
    const transferAmount = 0.05; // SOL

    console.log(`Transfer recipient: ${recipient.toBase58()}`);
    console.log(`Transfer amount: ${transferAmount} SOL`);

    // Get fresh multisig info
    const multisigInfoRes = await MultisigService.getMultisigInfo(
      connection,
      multisigPda
    );
    if (!multisigInfoRes.success || !multisigInfoRes.data) {
      console.log(
        "Failed to get multisig info:",
        multisigInfoRes.error?.message
      );
      return;
    }

    console.log(
      `Current multisig transaction index before proposal: ${multisigInfoRes.data.transactionIndex}`
    );

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

    // Create the integrated proposal
    const proposalTitle = "Integrated Transfer Test";
    const proposalDescription = `Transfer ${transferAmount} SOL to ${recipient.toBase58()}`;

    // Create proposal with enhanced debugging
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
    console.log(`Created integrated proposal: ${proposalAddress.toBase58()}`);

    // Wait a bit longer to ensure everything is processed
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Get fresh multisig state after proposal creation
    try {
      const afterCreateMultisigInfoRes = await MultisigService.getMultisigInfo(
        connection,
        multisigPda
      );
      if (
        !afterCreateMultisigInfoRes.success ||
        !afterCreateMultisigInfoRes.data
      ) {
        console.log(
          "Failed to get updated multisig info:",
          afterCreateMultisigInfoRes.error?.message
        );
      } else {
        console.log(
          `Multisig transaction index after proposal creation: ${afterCreateMultisigInfoRes.data.transactionIndex}`
        );
      }

      // Try to get the vault transaction and proposal that were just created
      const splGovernance = new SplGovernance(
        connection,
        new PublicKey(SPL_GOVERNANCE_PROGRAM_ID)
      );
      const proposalData = await splGovernance.getProposalByPubkey(
        proposalAddress
      );

      // This is a private method, access with caution
      // @ts-ignore: Accessing private static method
      const multisigInfo = ProposalService["extractMultisigInfo"](
        proposalData.descriptionLink
      );

      if (multisigInfo.transactionIndex) {
        console.log(
          `Found transaction index in proposal: ${multisigInfo.transactionIndex}`
        );

        // Check if vault transaction exists
        const [vaultTransactionPda] = multisig.getTransactionPda({
          multisigPda,
          index: BigInt(multisigInfo.transactionIndex),
        });

        // Check if proposal exists
        const [proposalPda] = multisig.getProposalPda({
          multisigPda,
          transactionIndex: BigInt(multisigInfo.transactionIndex),
        });

        try {
          const vaultTxInfo =
            await multisig.accounts.VaultTransaction.fromAccountAddress(
              connection,
              vaultTransactionPda
            );
          console.log("✅ Vault transaction created successfully!");

          try {
            const proposalInfo =
              await multisig.accounts.Proposal.fromAccountAddress(
                connection,
                proposalPda
              );
            console.log("✅ Multisig proposal created successfully!");
          } catch (err) {
            console.log("❌ Multisig proposal not found - might be an issue");
          }
        } catch (err) {
          console.log("❌ Vault transaction not found - might be an issue");
        }
      }
    } catch (err) {
      console.error("Error checking multisig state after creation:", err);
    }

    // Step 5: Vote on the proposal with debugging
    console.log("\n=== STEP 5: Voting on the proposal ===");

    // Skip premature multisig voting
    try {
      // Fetch the proposal to extract multisig info BEFORE voting
      const splGovernance = new SplGovernance(
        connection,
        new PublicKey(SPL_GOVERNANCE_PROGRAM_ID)
      );
      const proposalData = await splGovernance.getProposalByPubkey(
        proposalAddress
      );

      console.log("Proposal data retrieved, extracting multisig info...");
      // @ts-ignore: Accessing private static method
      const multisigInfo = ProposalService["extractMultisigInfo"](
        proposalData.descriptionLink
      );
      console.log("Extracted multisig info:", multisigInfo);

      // Vote on the DAO proposal
      console.log("Casting DAO vote");
      const voteRes = await ProposalService.castVote(
        connection,
        keypair,
        realmAddress,
        proposalAddress,
        true // approve
      );

      if (!voteRes.success) {
        console.log("Failed to cast vote:", voteRes.error?.message);
      } else {
        console.log(`Vote cast with signature: ${voteRes.data}`);
      }

      // Wait for vote recording
      await new Promise((resolve) => setTimeout(resolve, 3000));
    } catch (err) {
      console.error("Error in voting process:", err);
    }

    // Step 6: Verify the recipient received the funds
    console.log("\n=== STEP 6: Verifying recipient balance ===");

    // Wait for multisig transaction to be created and processed
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Check if funds were received, with retry logic
    let recipientBalance = 0;
    retries = 5;
    while (retries > 0) {
      recipientBalance = await connection.getBalance(recipient);
      console.log(`Recipient balance: ${recipientBalance / 1e9} SOL`);

      if (recipientBalance >= transferAmount * 1e9 * 0.9) {
        console.log(
          "\n✅ SUCCESS: Full integrated flow completed automatically!"
        );
        break;
      }

      console.log(`Waiting for funds to arrive... (${retries} retries left)`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      retries--;
    }

    // If funds didn't arrive automatically, try manual execution
    if (recipientBalance < transferAmount * 1e9 * 0.9) {
      console.log(
        "\n⚠️ Recipient didn't receive funds yet. Attempting manual execution..."
      );

      // Get multisig info from proposal description
      const splGovernance = new SplGovernance(
        connection,
        new PublicKey(SPL_GOVERNANCE_PROGRAM_ID)
      );

      const proposal = await splGovernance.getProposalByPubkey(proposalAddress);
      // @ts-ignore: Accessing private static method
      const multisigInfo = ProposalService["extractMultisigInfo"](
        proposal.descriptionLink
      );

      if (multisigInfo.multisigAddress && multisigInfo.transactionIndex) {
        console.log(`\nFound multisig info in proposal:`);
        console.log(
          `Multisig address: ${multisigInfo.multisigAddress.toBase58()}`
        );
        console.log(`Transaction index: ${multisigInfo.transactionIndex}`);

        try {
          // Approve the multisig transaction
          const approveRes = await MultisigService.approveProposal(
            connection,
            keypair,
            multisigInfo.multisigAddress,
            multisigInfo.transactionIndex
          );

          if (!approveRes.success) {
            console.log(
              "Failed to approve multisig transaction:",
              approveRes.error?.message
            );
          } else {
            console.log("Manually approved multisig transaction");
          }

          // Execute the multisig transaction
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
          } else {
            console.log("Manually executed multisig transaction");
          }

          // Wait for execution to complete and check balance again
          await new Promise((resolve) => setTimeout(resolve, 3000));
          const finalBalance = await connection.getBalance(recipient);
          console.log(`Final recipient balance: ${finalBalance / 1e9} SOL`);

          if (finalBalance >= transferAmount * 1e9 * 0.9) {
            console.log(
              "\n✅ SUCCESS: Manual execution completed successfully!"
            );
          } else {
            console.log(
              "\n❌ FAILURE: Manual execution failed to transfer funds."
            );
          }
        } catch (error) {
          console.error("Manual execution error:", error);
        }
      } else {
        console.log("Could not extract multisig info from proposal.");
      }
    }
  } catch (error) {
    console.error("Test failed with error:", error);
  }

  console.log("\n========== INTEGRATED TEST COMPLETE ==========");
}

runIntegratedTest().catch(console.error);
