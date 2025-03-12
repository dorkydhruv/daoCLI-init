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
import { ServiceResponse, MultisigData } from "../types/service-types";
import { sendTx } from "../utils/send_tx";

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
  ): Promise<ServiceResponse<{ multisigPda: PublicKey }>> {
    try {

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

        // Use the transaction helper to create and submit the transaction
        const tx = new Transaction().add(ix);
        tx.feePayer = keypair.publicKey;
        tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        tx.sign(...[keypair, createKey]);

        const res = await connection.sendRawTransaction(tx.serialize());
        await connection.confirmTransaction(res);

        return {
          success: true,
          data: { multisigPda },
        };
      } catch (error) {
        return {
          success: false,
          error: {
            message: "Error fetching program config",
            details: error,
          },
        };
      }
    } catch (error) {
      return {
        success: false,
        error: {
          message: "Failed to create multisig",
          details: error,
        },
      };
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
  ): Promise<ServiceResponse<{ multisigPda: PublicKey }>> {
    try {

      // Generate a deterministic keypair based on the realm address
      // If treasury is provided, use it for even more determinism
      const derivedKeypair = KeypairUtil.getRealmDerivedKeypair(realmAddress);

      // Use the derived keypair as createKey
      const [multisigPda] = multisig.getMultisigPda({
        createKey: derivedKeypair.publicKey,
      });
      // Store realm address in the memo for easier on-chain querying if needed
      const realmPrefix = "realm:";
      const memo = `${realmPrefix}${realmAddress.toBase58()}-${name}`;

      const multisigResult = await this.createMultisig(
        connection,
        keypair,
        threshold,
        members,
        memo,
        derivedKeypair
      );

      if (!multisigResult.success) {
        return multisigResult;
      }

      const multisigPdaExecuted = multisigResult.data!.multisigPda;

      if (!multisigPdaExecuted.equals(multisigPda)) {
        return {
          success: false,
          error: {
            message: "Multisig PDA mismatch",
          },
        };
      }

      return {
        success: true,
        data: { multisigPda },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          message: "Failed to create DAO-controlled multisig",
          details: error,
        },
      };
    }
  }

  /*
   Get the multisig vault pda for a given multisig
  */
  static getMultisigVaultPda(
    multisigPda: PublicKey
  ): ServiceResponse<PublicKey> {
    try {
      const [vaultPda] = multisig.getVaultPda({
        multisigPda,
        index: 0,
      });

      return {
        success: true,
        data: vaultPda,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          message: "Failed to get multisig vault PDA",
          details: error,
        },
      };
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
  ): Promise<ServiceResponse<string | undefined>> {
    try {
      if (!approve) {
        return {
          success: true,
          data: undefined,
        };
      }
      // Create approval instruction
      const ix = multisig.instructions.proposalApprove({
        multisigPda,
        transactionIndex: BigInt(transactionIndex),
        member: keypair.publicKey,
      });
      // Execute the transaction
      const txResult = await sendTx(connection, keypair, [ix]);

      if (!txResult.success) {
        return txResult;
      }

      return {
        success: true,
        data: txResult.data,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          message: "Failed to synchronize approval",
          details: error,
        },
      };
    }
  }

  /**
   * Checks if a multisig proposal is ready for execution (threshold met)
   */
  static async isProposalReadyToExecute(
    connection: Connection,
    multisigPda: PublicKey,
    transactionIndex: number
  ): Promise<ServiceResponse<boolean>> {
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
      return {
        success: true,
        data: approvalCount >= threshold,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          message: "Failed to check proposal execution readiness",
          details: error,
        },
      };
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
    title: string
  ): Promise<ServiceResponse<BigInt | undefined>> {
    try {
      const vaultPdaResult = this.getMultisigVaultPda(multisigPda);
      if (!vaultPdaResult.success) {
        return {
          success: false,
          data: undefined,
          error: vaultPdaResult.error ?? {
            message: "Failed to get multisig vault PDA",
          },
        };
      }

      const vaultPda = vaultPdaResult.data!;

      // Get multisig info
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
        transactionIndex: newTransactionIndex,
        creator: keypair.publicKey,
        vaultIndex: 0,
        ephemeralSigners: 0,
        transactionMessage,
        memo: `Proposal: ${title}`,
      });

      // Execute the transaction
      const txResult = await sendTx(connection, keypair, [createVaultTxIx]);

      if (!txResult.success) {
        return {
          success: false,
          data: undefined,
          error: txResult.error ?? {
            message: "Failed to create multisig transaction",
          },
        };
      }

      return {
        success: true,
        data: newTransactionIndex,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          message: "Failed to create multisig transaction",
          details: error,
        },
      };
    }
  }

  /**
   * Creates a proposal for an existing multisig transaction
   */
  static async createProposalForTransaction(
    connection: Connection,
    keypair: Keypair,
    multisigPda: PublicKey,
    transactionIndex: number
  ): Promise<ServiceResponse<string>> {
    try {
      // Create proposal instruction
      const ix = multisig.instructions.proposalCreate({
        multisigPda,
        transactionIndex: BigInt(transactionIndex),
        creator: keypair.publicKey,
      });

      // Execute the transaction
      return await sendTx(connection, keypair, [ix]);
    } catch (error) {
      return {
        success: false,
        error: {
          message: "Failed to create proposal for transaction",
          details: error,
        },
      };
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
  ): Promise<ServiceResponse<MultisigTransactionResult | undefined>> {
    try {
      // First create the transaction
      const txResult = await this.createMultisigTransaction(
        connection,
        multisigPda,
        keypair,
        instructions,
        title
      );

      if (!txResult.success) {
        return {
          success: false,
          data: undefined,
          error: txResult.error ?? {
            message: "Unable to create Multisig transaction",
          },
        };
      }

      const transactionIndex = Number(txResult.data!);

      // Then create the proposal
      const proposalResult = await this.createProposalForTransaction(
        connection,
        keypair,
        multisigPda,
        transactionIndex
      );

      if (!proposalResult.success) {
        return {
          success: false,
          error: {
            message: "Created transaction but failed to create proposal",
            details: proposalResult.error,
          },
        };
      }

      return {
        success: true,
        data: {
          transactionIndex,
          multisigPda,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          message: "Failed to create transaction with proposal",
          details: error,
        },
      };
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
  ): Promise<ServiceResponse<string>> {
    try {

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
        // Check if the user already approved this proposal
        const alreadyApproved = proposal.approved.some((approver) =>
          approver.equals(keypair.publicKey)
        );
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
          // shouldnt vote therefore
        }
      } catch (e) {
        // Proposal doesn't exist yet

      }

      // Create approval instruction
      const ix = multisig.instructions.proposalApprove({
        multisigPda,
        transactionIndex: BigInt(transactionIndex),
        member: keypair.publicKey,
      });

      // Create and send transaction
      return await sendTx(connection, keypair, [ix]);
    } catch (error) {
      return {
        success: false,
        error: {
          message: "Failed to approve proposal",
          details: error,
        },
      };
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
  ): Promise<ServiceResponse<string>> {
    try {

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

      // Execute the transaction
      return await sendTx(connection, keypair, [ix.instruction]);
    } catch (error) {
      return {
        success: false,
        error: {
          message: "Failed to execute multisig transaction",
          details: error,
        },
      };
    }
  }

  /**
   * Finds the multisig associated with a realm address
   * Uses the same deterministic derivation as createDaoControlledMultisig
   */
  static getMultisigForRealm(
    realmAddress: PublicKey
  ): ServiceResponse<PublicKey> {
    try {
      const multisigPda =
        KeypairUtil.getRealmAssociatedMultisigAddress(realmAddress);

      return {
        success: true,
        data: multisigPda,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          message: "Failed to get multisig for realm",
          details: error,
        },
      };
    }
  }

  /**
   * Calculates if adding an approval would meet the threshold
   */
  static async wouldMeetThreshold(
    connection: Connection,
    multisigPda: PublicKey,
    transactionIndex: number
  ): Promise<ServiceResponse<boolean>> {
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

        return {
          success: true,
          data: approvalCount >= threshold,
        };
      } catch {
        // Proposal might not exist yet
        return {
          success: true,
          data: multisigAccount.threshold <= 1,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: {
          message: "Failed to check threshold",
          details: error,
        },
      };
    }
  }

  /**
   * Get proposal status and whether it meets threshold
   */
  static async getProposalStatus(
    connection: Connection,
    multisigPda: PublicKey,
    transactionIndex: number
  ): Promise<
    ServiceResponse<{
      exists: boolean;
      approvalCount: number;
      threshold: number;
      meetsThreshold: boolean;
    }>
  > {
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
          success: true,
          data: {
            exists: true,
            approvalCount,
            threshold,
            meetsThreshold,
          },
        };
      } catch {
        // Proposal doesn't exist yet
        return {
          success: true,
          data: {
            exists: false,
            approvalCount: 0,
            threshold,
            meetsThreshold: false,
          },
        };
      }
    } catch (error) {
      return {
        success: false,
        error: {
          message: "Failed to check proposal status",
          details: error,
        },
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
  ): Promise<
    ServiceResponse<{
      approved: boolean;
      executed: boolean;
      signature?: string;
    }>
  > {
    try {
      // First check if our approval would meet the threshold
      const thresholdResult = await this.wouldMeetThreshold(
        connection,
        multisigPda,
        transactionIndex
      );

      if (!thresholdResult.success) {
        return {
          success: false,
          data: {
            approved: false,
            executed: false,
          },
          error: thresholdResult.error ?? { message: "Threshold error" },
        };
      }

      const willMeetThreshold = thresholdResult.data!;

      // Approve the transaction
      const approveResult = await this.approveProposal(
        connection,
        keypair,
        multisigPda,
        transactionIndex
      );

      if (!approveResult.success) {
        return {
          success: false,
          data: {
            approved: false,
            executed: false,
          },
          error: approveResult.error ?? {
            message: "Couldn't approve proposal",
          },
        };
      }

      const approveSig = approveResult.data!;

      // If threshold is met, execute immediately
      if (willMeetThreshold) {
        const executeResult = await this.executeMultisigTransaction(
          connection,
          keypair,
          multisigPda,
          transactionIndex
        );

        if (!executeResult.success) {
          return {
            success: true,
            data: {
              approved: true,
              executed: false,
              signature: approveSig,
            },
          };
        }

        return {
          success: true,
          data: {
            approved: true,
            executed: true,
            signature: executeResult.data ?? "",
          },
        };
      }

      return {
        success: true,
        data: {
          approved: true,
          executed: false,
          signature: approveSig,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          message: "Failed to approve and execute transaction",
          details: error,
        },
      };
    }
  }

  /**
   * Gets information about a multisig account
   */
  static async getMultisigInfo(
    connection: Connection,
    multisigPda: PublicKey
  ): Promise<ServiceResponse<MultisigData>> {
    try {
      const multisigAccount =
        await multisig.accounts.Multisig.fromAccountAddress(
          connection,
          multisigPda
        );

      return {
        success: true,
        data: {
          threshold: multisigAccount.threshold,
          memberCount: multisigAccount.members.length,
          transactionIndex: Number(multisigAccount.transactionIndex),
          members: multisigAccount.members.map((m) => m.key),
          multisigPda,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          message: "Failed to get multisig info",
          details: error,
        },
      };
    }
  }
}
