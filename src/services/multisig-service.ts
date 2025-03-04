import {
  Connection,
  Keypair,
  PublicKey,
  TransactionInstruction,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import { SQDS_PROGRAM_ID } from "../utils/constants";

export class MultisigService {
  static async createMultisig(
    connection: Connection,
    keypair: Keypair,
    threshold: number,
    members: PublicKey[],
    name: string
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
          rentCollector: createKey.publicKey, // Use the creator as the rent collector
        });

        const tx = new Transaction().add(ix);
        tx.feePayer = createKey.publicKey;
        tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        // Check program account info
        const programInfo = await connection.getAccountInfo(
          new PublicKey(SQDS_PROGRAM_ID)
        );
        if (!programInfo) {
          console.warn(
            "No program info found for SQDS_PROGRAM_ID",
            SQDS_PROGRAM_ID
          );
        } else {
          console.log("Program info:", programInfo.owner.toBase58());
        }

        tx.sign(createKey);
        const res = await connection.sendRawTransaction(tx.serialize());
        connection.confirmTransaction(res);
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

  static async getMultisigs(
    connection: Connection,
    authority: PublicKey
  ): Promise<PublicKey> {
    try {
      return multisig.getMultisigPda({ createKey: authority })[0];
    } catch (error) {
      console.error("Failed to get multisigs:", error);
      throw error;
    }
  }

  // static async proposeTransaction(
  //   connection: Connection,
  //   multisigPda: PublicKey,
  //   keypair: Keypair,
  //   instructions: TransactionInstruction[],
  //   name: string
  // ): Promise<{ txPda: PublicKey; signature: string }> {
  //   try {
  //     // Generate a transaction PDA
  //     const vaultTransactionIndex = 0; // This would normally be incremented
  //     const [txPda] = multisig.getTransactionPda({
  //       multisigPda,
  //       index: vaultTransactionIndex,
  //     });

  //     // Create the transaction
  //     const createTxIx = multisig.instructions.transactionCreateV2({
  //       multisigPda,
  //       transactionPda: txPda,
  //       creator: keypair.publicKey,
  //       authority: keypair.publicKey,
  //       ephemeralSigners: 0,
  //       instructions,
  //     });

  //     const tx = new Transaction().add(createTxIx);
  //     const signature = await sendAndConfirmTransaction(connection, tx, [
  //       keypair,
  //     ]);

  //     return { txPda, signature };
  //   } catch (error) {
  //     console.error("Failed to propose transaction:", error);
  //     throw error;
  //   }
  // }

  // static async approveTransaction(
  //   connection: Connection,
  //   multisigPda: PublicKey,
  //   transactionPda: PublicKey,
  //   keypair: Keypair
  // ): Promise<string> {
  //   try {
  //     // Create approval instruction
  //     const approveIx = multisig.instructions.transactionApproveV2({
  //       multisigPda,
  //       transactionPda,
  //       member: keypair.publicKey,
  //     });

  //     const tx = new Transaction().add(approveIx);
  //     const signature = await sendAndConfirmTransaction(connection, tx, [
  //       keypair,
  //     ]);

  //     return signature;
  //   } catch (error) {
  //     console.error("Failed to approve transaction:", error);
  //     throw error;
  //   }
  // }

  // static async executeTransaction(
  //   connection: Connection,
  //   multisigPda: PublicKey,
  //   transactionPda: PublicKey,
  //   keypair: Keypair
  // ): Promise<string> {
  //   try {
  //     // Create execute instruction
  //     const executeIx = multisig.instructions.transactionExecuteV2({
  //       multisigPda,
  //       transactionPda,
  //       member: keypair.publicKey,
  //     });

  //     const tx = new Transaction().add(executeIx);
  //     const signature = await sendAndConfirmTransaction(connection, tx, [
  //       keypair,
  //     ]);

  //     return signature;
  //   } catch (error) {
  //     console.error("Failed to execute transaction:", error);
  //     throw error;
  //   }
  // }

  //   static async getUserMultisigs(
  //     connection: Connection,
  //     userPublicKey: PublicKey
  //   ): Promise<PublicKey[]> {
  //     try {
  //       // In a production app, you'd use getProgramAccounts to find all multisigs where the user is a member
  //       const multisigAccounts = await connection.getProgramAccounts(
  //         new PublicKey(multisig.PROGRAM_ID),
  //         {
  //           filters: [
  //             {
  //               // Filter for only Multisig accounts
  //               memcmp: {
  //                 offset: 0, // Discriminator offset
  //                 bytes: multisig.accounts.Multisig.discriminator,
  //               },
  //             },
  //           ],
  //         }
  //       );

  //       const userMultisigs: PublicKey[] = [];

  //       for (const account of multisigAccounts) {
  //         try {
  //           const multisigAccount = multisig.accounts.Multisig.fromAccountInfo(
  //             account.account
  //           )[0];

  //           // Check if user is a member
  //           const isMember = multisigAccount.members.some((m) =>
  //             m.key.equals(userPublicKey)
  //           );

  //           if (isMember) {
  //             userMultisigs.push(account.pubkey);
  //           }
  //         } catch (err) {
  //           console.warn(`Failed to parse multisig account: ${err}`);
  //           // Skip this account and continue
  //         }
  //       }

  //       return userMultisigs;
  //     } catch (error) {
  //       console.error("Failed to get user multisigs:", error);
  //       throw error;
  //     }
  //   }
}
