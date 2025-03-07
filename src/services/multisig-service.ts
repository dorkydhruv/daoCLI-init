import {
  Connection,
  Keypair,
  PublicKey,
  TransactionInstruction,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import { KeypairUtil } from "../utils/keypair-util";

export interface MultisigTransactionResult {
  transactionIndex: number;
  multisigPda: PublicKey;
}

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
    createKey: Keypair
  ): Promise<{ multisigPda: PublicKey }> {
    try {
      console.log(
        `Creating multisig with ${members.length} members and threshold ${threshold}`
      );

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
          memo: name,
          rentCollector: keypair.publicKey, // Use the creator as the rent collector
        });
        const tx = new Transaction().add(ix);
        tx.feePayer = keypair.publicKey;
        tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        tx.sign(...[keypair, createKey]);
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
    realmAddress: PublicKey
  ): Promise<{ multisigPda: PublicKey }> {
    try {
      console.log(
        `Creating DAO-controlled multisig with ${members.length} members and threshold ${threshold}`
      );

      // Generate a deterministic keypair based on the realm address
      // If treasury is provided, use it for even more determinism
      const derivedKeypair = KeypairUtil.getRealmDerivedKeypair(realmAddress);

      console.log(
        `Using realm-derived createKey: ${derivedKeypair.publicKey.toBase58()}`
      );
      console.log(`Associated with realm: ${realmAddress.toBase58()}`);

      // Use the derived keypair as createKey
      const [multisigPda] = multisig.getMultisigPda({
        createKey: derivedKeypair.publicKey,
      });
      // Store realm address in the memo for easier on-chain querying if needed
      const realmPrefix = "realm:";
      const memo = `${realmPrefix}${realmAddress.toBase58()}-${name}`;

      const multisigPdaExecuted = await this.createMultisig(
        connection,
        keypair,
        threshold,
        members,
        memo,
        derivedKeypair
      );
      if (!multisigPdaExecuted.multisigPda.equals(multisigPda))
        throw new Error("Multisig PDA mismatch");
      console.log(`Created multisig at address: ${multisigPda.toBase58()}`);
      console.log(`With ${members.length} members and threshold ${threshold}`);

      return { multisigPda };
    } catch (error) {
      console.error("Failed to create DAO-controlled multisig:", error);
      throw error;
    }
  }

  /*
   Get the multisig vault pda for a given multisig
  */
  static getMultisigVaultPda(multisigPda: PublicKey): PublicKey {
    const [vaultPda] = multisig.getVaultPda({
      multisigPda,
      index: 0,
    });
    return vaultPda;
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
    multisigPda: PublicKey,
    keypair: Keypair,
    instructions: TransactionInstruction[],
    title: String
  ): Promise<BigInt> {
    const vaultPda = this.getMultisigVaultPda(multisigPda);
    const multisigInfo = await multisig.accounts.Multisig.fromAccountAddress(
      connection,
      multisigPda
    );
    const currentTransactionIndex = Number(multisigInfo.transactionIndex);
    const newTransactionIndex = BigInt(currentTransactionIndex + 1);
    // Create transaction message with the provided instructions
    const transactionMessage = new TransactionMessage({
      payerKey: vaultPda, // The vault is the payer for the inner transaction
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions,
    });
    const createVaultTxIx = multisig.instructions.vaultTransactionCreate({
      multisigPda: multisigPda,
      transactionIndex: newTransactionIndex, // Use NEXT index, not current
      creator: keypair.publicKey,
      vaultIndex: 0,
      ephemeralSigners: 0,
      transactionMessage,
      memo: `Proposal: ${title}`,
    });

    const sig = await this.executeTransaction(connection, keypair, [
      createVaultTxIx,
    ]);
    console.log(`Vault TX created with signature: ${sig}`);
    return newTransactionIndex;
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
   * Creates a complete transaction with proposal in one operation
   * This combines createMultisigTransaction and createProposalForTransaction
   */
  static async createTransactionWithProposal(
    connection: Connection,
    multisigPda: PublicKey,
    keypair: Keypair,
    instructions: TransactionInstruction[],
    title: string
  ): Promise<MultisigTransactionResult> {
    try {
      console.log(`Creating unified multisig transaction for "${title}"`);

      // First create the transaction
      const newTransactionIndex = await this.createMultisigTransaction(
        connection,
        multisigPda,
        keypair,
        instructions,
        title
      );

      const transactionIndex = Number(newTransactionIndex);
      console.log(`Transaction created with index: ${transactionIndex}`);

      // Then create the proposal
      await this.createProposalForTransaction(
        connection,
        keypair,
        multisigPda,
        transactionIndex
      );
      console.log(`Proposal created for transaction #${transactionIndex}`);

      return {
        transactionIndex,
        multisigPda,
      };
    } catch (error) {
      console.error("Failed to create transaction with proposal:", error);
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
      const signature = await this.executeTransaction(connection, keypair, [
        ix,
      ]);
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
   * Made public for easy reuse by other services
   */
  static async executeInstructions(
    connection: Connection,
    payer: Keypair,
    instructions: TransactionInstruction[]
  ): Promise<string> {
    const recentBlockhash = await connection.getLatestBlockhash({
      commitment: "confirmed",
    });

    const txMessage = new TransactionMessage({
      payerKey: payer.publicKey,
      instructions,
      recentBlockhash: recentBlockhash.blockhash,
    }).compileToV0Message();

    const tx = new VersionedTransaction(txMessage);
    tx.sign([payer]);

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
   * Helper function to execute instructions - made public for reuse by other services
   */
  static async executeTransaction(
    connection: Connection,
    keypair: Keypair,
    instructions: TransactionInstruction[]
  ): Promise<string> {
    return this.executeInstructions(connection, keypair, instructions);
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
   * Get proposal status and whether it meets threshold
   */
  static async getProposalStatus(
    connection: Connection,
    multisigPda: PublicKey,
    transactionIndex: number
  ): Promise<{
    exists: boolean;
    approvalCount: number;
    threshold: number;
    meetsThreshold: boolean;
  }> {
    try {
      // Get the multisig account to check threshold
      const multisigAccount =
        await multisig.accounts.Multisig.fromAccountAddress(
          connection,
          multisigPda
        );

      const threshold = multisigAccount.threshold;

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

        const approvalCount = proposal.approved.length;
        const meetsThreshold = approvalCount >= threshold;

        return {
          exists: true,
          approvalCount,
          threshold,
          meetsThreshold,
        };
      } catch {
        // Proposal doesn't exist yet
        return {
          exists: false,
          approvalCount: 0,
          threshold,
          meetsThreshold: false,
        };
      }
    } catch (error) {
      console.error("Failed to check proposal status:", error);
      return {
        exists: false,
        approvalCount: 0,
        threshold: 0,
        meetsThreshold: false,
      };
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
