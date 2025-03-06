import {
  Connection,
  Keypair,
  PublicKey,
  TransactionInstruction,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import { KeypairUtil } from "../utils/keypair-util";

export class MultisigService {
  /**
   * Creates a standalone Squads multisig
   */
  static async createMultisig(
    connection: Connection,
    keypair: Keypair,
    threshold: number,
    members: PublicKey[],
    name: string,
    createKey?: PublicKey
  ): Promise<{ multisigPda: PublicKey }> {
    try {
      console.log(
        `Creating multisig with ${members.length} members and threshold ${threshold}`
      );

      const createKey = keypair;

      // Calculate the multisig PDA
      const [multisigPda] = multisig.getMultisigPda({
        createKey: createKey.publicKey,
      });

      // Get program config for fee payments
      const programConfigPda = multisig.getProgramConfigPda({})[0];

      try {
        const programConfig =
          await multisig.accounts.ProgramConfig.fromAccountAddress(
            connection,
            programConfigPda
          );

        const configTreasury = programConfig.treasury;
        console.log(
          `Using program config treasury: ${configTreasury.toBase58()}`
        );

        // Create the multisig transaction
        const ix = multisig.instructions.multisigCreateV2({
          createKey: createKey.publicKey,
          creator: createKey.publicKey,
          multisigPda,
          configAuthority: null,
          timeLock: 0,
          members: members.map((m) => ({
            key: m,
            permissions: multisig.types.Permissions.all(),
          })),
          threshold: threshold,
          treasury: configTreasury,
          memo: name,
          rentCollector: createKey.publicKey, // Use the creator as the rent collector
        });
        const tx = new Transaction().add(ix);
        tx.feePayer = createKey.publicKey;
        tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        tx.sign(createKey);
        const res = await connection.sendRawTransaction(tx.serialize());
        await connection.confirmTransaction(res);
        console.log("Transaction sent:", res);
        return { multisigPda };
      } catch (error) {
        console.error("Error fetching program config:", error);
        throw error;
      }
    } catch (error) {
      console.error("Failed to create multisig:", error);
      throw error;
    }
  }

  /**
   * Creates a Squads multisig controlled by a DAO governance account
   * Uses a deterministic approach based on the realm address
   */
  static async createDaoControlledMultisig(
    connection: Connection,
    keypair: Keypair,
    threshold: number,
    members: PublicKey[],
    name: string,
    governanceAddress: PublicKey,
    realmAddress: PublicKey // Changed from treasuryAddress to realmAddress for clarity
  ): Promise<{ multisigPda: PublicKey }> {
    try {
      console.log(
        `Creating DAO-controlled multisig with ${members.length} members and threshold ${threshold}`
      );

      // Generate a deterministic keypair based on the realm address
      const derivedKeypair = KeypairUtil.getRealmDerivedKeypair(realmAddress);

      console.log(
        `Using realm-derived createKey: ${derivedKeypair.publicKey.toBase58()}`
      );
      console.log(`Associated with realm: ${realmAddress.toBase58()}`);

      // Use the derived keypair as createKey
      const [multisigPda] = multisig.getMultisigPda({
        createKey: derivedKeypair.publicKey,
      });

      // Get program config for fee payments
      const programConfigPda = multisig.getProgramConfigPda({})[0];
      const programConfig =
        await multisig.accounts.ProgramConfig.fromAccountAddress(
          connection,
          programConfigPda
        );

      const configTreasury = programConfig.treasury;

      // Store realm address in the memo for easier on-chain querying if needed
      const realmPrefix = "realm:";
      const memo = `${realmPrefix}${realmAddress.toBase58()}`;

      // Create the multisig transaction
      const ix = multisig.instructions.multisigCreateV2({
        createKey: derivedKeypair.publicKey,
        creator: keypair.publicKey,
        multisigPda,
        configAuthority: null,
        timeLock: 0,
        members: members.map((m) => ({
          key: m,
          permissions: multisig.types.Permissions.all(),
        })),
        threshold: threshold,
        treasury: configTreasury,
        memo: memo, // Store realm association in memo
        rentCollector: keypair.publicKey,
      });

      const tx = new Transaction().add(ix);
      tx.feePayer = keypair.publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      // Sign with both the user's keypair and our derived keypair
      tx.sign(keypair, derivedKeypair);

      const res = await connection.sendRawTransaction(tx.serialize());
      await connection.confirmTransaction(res);

      console.log(`Created multisig at address: ${multisigPda.toBase58()}`);
      console.log(`With ${members.length} members and threshold ${threshold}`);

      return { multisigPda };
    } catch (error) {
      console.error("Failed to create DAO-controlled multisig:", error);
      throw error;
    }
  }

  /**
   * Creates a synchronized transaction in both the DAO and Squads multisig
   */
  static async createSynchronizedProposal(
    connection: Connection,
    keypair: Keypair,
    multisigPda: PublicKey,
    transactionIndex: number
  ): Promise<string> {
    try {
      // Create proposal instruction for Squads
      const ix = multisig.instructions.proposalCreate({
        multisigPda,
        transactionIndex: BigInt(transactionIndex),
        creator: keypair.publicKey,
      });

      // Execute the transaction
      return await this.executeTransaction(connection, keypair, [ix]);
    } catch (error) {
      console.error("Failed to create synchronized proposal:", error);
      throw error;
    }
  }

  /**
   * Approves a multisig proposal as part of DAO voting
   */
  static async voteSynchronized(
    connection: Connection,
    keypair: Keypair,
    multisigPda: PublicKey,
    transactionIndex: number,
    approve: boolean
  ): Promise<string | undefined> {
    try {
      if (!approve) {
        console.log("Vote is a denial - no Squads approval needed");
        return undefined;
      }

      // Create approval instruction
      const ix = multisig.instructions.proposalApprove({
        multisigPda,
        transactionIndex: BigInt(transactionIndex),
        member: keypair.publicKey,
      });

      // Execute the transaction
      return await this.executeTransaction(connection, keypair, [ix]);
    } catch (error) {
      console.error("Failed to synchronize approval:", error);
      throw error;
    }
  }

  /**
   * Checks if a multisig proposal is ready for execution (threshold met)
   */
  static async isProposalReadyToExecute(
    connection: Connection,
    multisigPda: PublicKey,
    transactionIndex: number
  ): Promise<boolean> {
    try {
      // Get the proposal account
      const [proposalPda] = multisig.getProposalPda({
        multisigPda,
        transactionIndex: BigInt(transactionIndex),
      });

      const proposal = await multisig.accounts.Proposal.fromAccountAddress(
        connection,
        proposalPda
      );

      // Get the multisig account to check threshold
      const multisigAccount =
        await multisig.accounts.Multisig.fromAccountAddress(
          connection,
          multisigPda
        );

      const approvalCount = proposal.approved.length;
      const threshold = multisigAccount.threshold;

      console.log(
        `Proposal has ${approvalCount} approvals, threshold is ${threshold}`
      );

      return approvalCount >= threshold;
    } catch (error) {
      console.error("Failed to check proposal execution readiness:", error);
      return false;
    }
  }

  /**
   * Creates a transaction to transfer SOL from a multisig vault to a recipient
   */
  static async createMultisigTransaction(
    connection: Connection,
    recipient: PublicKey,
    amount: number,
    multisigPda: PublicKey,
    treasuryAddress: PublicKey
  ): Promise<TransactionInstruction[]> {
    const [vaultPda] = multisig.getVaultPda({
      multisigPda,
      index: 0,
    });
    const multisigInfo = await multisig.accounts.Multisig.fromAccountAddress(
      connection,
      multisigPda
    );
    const currentTransactionIndex = Number(multisigInfo.transactionIndex);
    const newTransactionIndex = BigInt(currentTransactionIndex + 1);
    const transferInstruction = SystemProgram.transfer({
      fromPubkey: vaultPda,
      toPubkey: recipient,
      lamports: amount * LAMPORTS_PER_SOL,
    });
    const testTransferMessage = new TransactionMessage({
      payerKey: vaultPda,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions: [transferInstruction],
    });
    const ix = multisig.instructions.vaultTransactionCreate({
      multisigPda,
      transactionIndex: newTransactionIndex,
      creator: treasuryAddress,
      vaultIndex: 0,
      ephemeralSigners: 0,
      transactionMessage: testTransferMessage,
      memo: "Transfer to recipient using DAO-Cli",
    });
    return [ix];
  }

  /**
   * Creates a proposal for an existing multisig transaction
   */
  static async createProposalForTransaction(
    connection: Connection,
    keypair: Keypair,
    multisigPda: PublicKey,
    transactionIndex: number
  ): Promise<string> {
    try {
      // Create proposal instruction
      const ix = multisig.instructions.proposalCreate({
        multisigPda,
        transactionIndex: BigInt(transactionIndex),
        creator: keypair.publicKey,
      });

      // Execute the transaction
      return await this.executeTransaction(connection, keypair, [ix]);
    } catch (error) {
      console.error("Failed to create proposal for transaction:", error);
      throw error;
    }
  }

  /**
   * Approves a multisig proposal
   */
  static async approveProposal(
    connection: Connection,
    keypair: Keypair,
    multisigPda: PublicKey,
    transactionIndex: number
  ): Promise<string> {
    try {
      console.log(
        `Approving multisig proposal at index ${transactionIndex} for multisig ${multisigPda.toBase58()}`
      );

      // First check if the proposal exists
      const [proposalPda] = multisig.getProposalPda({
        multisigPda,
        transactionIndex: BigInt(transactionIndex),
      });

      // Get fresh multisig info to ensure we're using the correct state
      const multisigInfo = await multisig.accounts.Multisig.fromAccountAddress(
        connection,
        multisigPda
      );
      console.log(
        `Current multisig transaction index: ${multisigInfo.transactionIndex}`
      );

      try {
        // Try to fetch the proposal to see if it exists
        const proposal = await multisig.accounts.Proposal.fromAccountAddress(
          connection,
          proposalPda
        );
        console.log(
          `Found proposal with ${proposal.approved.length} current approvals`
        );

        // Check if the user already approved this proposal
        const alreadyApproved = proposal.approved.some((approver) =>
          approver.equals(keypair.publicKey)
        );

        if (alreadyApproved) {
          console.log(`You have already approved this proposal.`);
          // You might want to return early here
        }

        // Get multisig account to check membership
        const multisigAccount =
          await multisig.accounts.Multisig.fromAccountAddress(
            connection,
            multisigPda
          );

        // Check if the keypair is a member
        const isMember = multisigAccount.members.some((m) =>
          m.key.equals(keypair.publicKey)
        );

        if (!isMember) {
          console.log(
            `Warning: ${keypair.publicKey.toBase58()} is not a member of this multisig`
          );
        }
      } catch (e) {
        console.log(
          `Unable to find proposal at index ${transactionIndex}. It might not exist yet.`
        );
        console.log(
          `You may need to execute the DAO proposal first to create the multisig transaction.`
        );
      }

      // Create approval instruction
      const ix = multisig.instructions.proposalApprove({
        multisigPda,
        transactionIndex: BigInt(transactionIndex),
        member: keypair.publicKey,
      });

      // Create and send transaction
      const tx = new Transaction().add(ix);
      tx.feePayer = keypair.publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      tx.sign(keypair);

      const signature = await connection.sendRawTransaction(tx.serialize(), {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      });

      await connection.confirmTransaction(signature, "confirmed");
      console.log(
        `Successfully approved multisig proposal with signature: ${signature}`
      );
      return signature;
    } catch (error) {
      console.error("Failed to approve proposal:", error);
      throw error;
    }
  }

  /**
   * Executes an approved multisig transaction
   */
  static async executeMultisigTransaction(
    connection: Connection,
    keypair: Keypair,
    multisigPda: PublicKey,
    transactionIndex: number
  ): Promise<string> {
    try {
      console.log(`Executing multisig transaction #${transactionIndex}`);

      // Get fresh multisig info
      const multisigInfo = await multisig.accounts.Multisig.fromAccountAddress(
        connection,
        multisigPda
      );

      // Create execute instruction
      const ix = await multisig.instructions.vaultTransactionExecute({
        multisigPda,
        transactionIndex: BigInt(transactionIndex),
        member: keypair.publicKey,
        connection,
      });

      // Create and send transaction
      const tx = new Transaction().add(ix.instruction);
      tx.feePayer = keypair.publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      tx.sign(keypair);

      const signature = await connection.sendRawTransaction(tx.serialize(), {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      });

      await connection.confirmTransaction(signature, "confirmed");
      console.log(
        `Successfully executed multisig transaction with signature: ${signature}`
      );
      return signature;
    } catch (error) {
      console.error("Failed to execute multisig transaction:", error);
      throw error;
    }
  }

  /**
   * Helper function to execute instructions
   */
  private static async executeTransaction(
    connection: Connection,
    keypair: Keypair,
    instructions: TransactionInstruction[]
  ): Promise<string> {
    const recentBlockhash = await connection.getLatestBlockhash({
      commitment: "confirmed",
    });

    const txMessage = new TransactionMessage({
      payerKey: keypair.publicKey,
      instructions,
      recentBlockhash: recentBlockhash.blockhash,
    }).compileToV0Message();

    const tx = new VersionedTransaction(txMessage);
    tx.sign([keypair]);

    const signature = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });

    await connection.confirmTransaction(
      {
        signature,
        blockhash: recentBlockhash.blockhash,
        lastValidBlockHeight: recentBlockhash.lastValidBlockHeight,
      },
      "confirmed"
    );

    return signature;
  }

  /**
   * Find the multisig PDA created with the treasury as the createKey
   */
  static findMultisigForTreasury(treasuryAddress: PublicKey): PublicKey {
    const [multisigPda] = multisig.getMultisigPda({
      createKey: treasuryAddress,
    });
    return multisigPda;
  }

  /**
   * Finds the multisig associated with a realm address
   * Uses the same deterministic derivation as createDaoControlledMultisig
   */
  static getMultisigForRealm(realmAddress: PublicKey): PublicKey {
    return KeypairUtil.getRealmAssociatedMultisigAddress(realmAddress);
  }

  /**
   * Calculates if adding an approval would meet the threshold
   */
  static async wouldMeetThreshold(
    connection: Connection,
    multisigPda: PublicKey,
    transactionIndex: number
  ): Promise<boolean> {
    try {
      // Get the multisig account to check threshold
      const multisigAccount =
        await multisig.accounts.Multisig.fromAccountAddress(
          connection,
          multisigPda
        );

      // Get the proposal account
      const [proposalPda] = multisig.getProposalPda({
        multisigPda,
        transactionIndex: BigInt(transactionIndex),
      });

      try {
        const proposal = await multisig.accounts.Proposal.fromAccountAddress(
          connection,
          proposalPda
        );

        // Existing approvals + 1 (our new approval)
        const approvalCount = proposal.approved
          ? proposal.approved.length + 1
          : 1;
        const threshold = multisigAccount.threshold;

        return approvalCount >= threshold;
      } catch {
        // Proposal might not exist yet
        return multisigAccount.threshold <= 1;
      }
    } catch (error) {
      console.error("Failed to check threshold:", error);
      return false;
    }
  }

  /**
   * Approves and executes a multisig transaction in one step if threshold is met
   */
  static async approveAndExecuteIfReady(
    connection: Connection,
    keypair: Keypair,
    multisigPda: PublicKey,
    transactionIndex: number
  ): Promise<{ approved: boolean; executed: boolean; signature?: string }> {
    try {
      // First check if our approval would meet the threshold
      const willMeetThreshold = await this.wouldMeetThreshold(
        connection,
        multisigPda,
        transactionIndex
      );

      // Approve the transaction
      const approveSig = await this.approveProposal(
        connection,
        keypair,
        multisigPda,
        transactionIndex
      );

      // If threshold is met, execute immediately
      if (willMeetThreshold) {
        try {
          const executeSig = await this.executeMultisigTransaction(
            connection,
            keypair,
            multisigPda,
            transactionIndex
          );

          return {
            approved: true,
            executed: true,
            signature: executeSig,
          };
        } catch (error) {
          console.error("Failed to execute after approval:", error);
          return {
            approved: true,
            executed: false,
            signature: approveSig,
          };
        }
      }

      return {
        approved: true,
        executed: false,
        signature: approveSig,
      };
    } catch (error) {
      console.error("Failed to approve transaction:", error);
      return {
        approved: false,
        executed: false,
      };
    }
  }
}
