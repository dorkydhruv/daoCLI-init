import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ConfigService } from "../services/config-service";
import { PublicKey, LAMPORTS_PER_SOL, Keypair } from "@solana/web3.js";
import { MultisigService } from "../services/multisig-service";
import { useMcpContext } from "../utils/mcp-hooks";

// Standalone Squads Multisig Tool
export function registerMultisigTools(server: McpServer) {
  // Add createMultisig tool
  server.tool(
    "createMultisig",
    "Create a new standalone Squads multisig",
    {
      name: z.string(),
      members: z.array(z.string()),
      threshold: z.number(),
    },
    async ({ name, members, threshold }) => {
      try {
        const context = await useMcpContext({ requireWallet: true });
        if (!context.success) {
          return {
            content: [
              {
                type: "text",
                text: `${context.error}\n\nSuggestion: ${
                  context.suggestion ||
                  "Create a wallet with 'createWallet' first"
                }`,
              },
            ],
          };
        }

        const { connection, keypair } = context;
        const membersPubkeys: PublicKey[] = [keypair.publicKey];
        const invalidMembers: string[] = [];

        for (const member of members) {
          try {
            if (member !== keypair.publicKey.toBase58()) {
              membersPubkeys.push(new PublicKey(member));
            }
          } catch (e) {
            invalidMembers.push(member);
          }
        }

        if (invalidMembers.length > 0) {
          return {
            content: [
              {
                type: "text",
                text: `Invalid member addresses: ${invalidMembers.join(
                  ", "
                )}\n\nSuggestion: Member addresses should be valid Solana public keys. Example format: ${keypair.publicKey.toBase58()}`,
              },
            ],
          };
        }

        if (threshold < 1 || threshold > membersPubkeys.length) {
          return {
            content: [
              {
                type: "text",
                text: `Invalid threshold (${threshold}). Must be between 1 and ${membersPubkeys.length}\n\nSuggestion: Set threshold to a value that represents the minimum number of required approvals`,
              },
            ],
          };
        }

        const createKey = Keypair.generate();
        const createResult = await MultisigService.createMultisig(
          connection,
          keypair,
          threshold,
          membersPubkeys,
          name,
          createKey
        );

        if (!createResult.success || !createResult.data) {
          return {
            content: [
              {
                type: "text",
                text: `Failed to create multisig: ${createResult.error?.message}\n\nSuggestion: Ensure you have enough SOL to pay for transaction fees and try again`,
              },
            ],
          };
        }

        await ConfigService.setActiveSquadsMultisig(
          createResult.data.multisigPda.toBase58()
        );

        return {
          content: [
            {
              type: "text",
              text:
                JSON.stringify(
                  {
                    success: true,
                    multisigAddress: createResult.data.multisigPda.toBase58(),
                    name,
                    threshold,
                    members: membersPubkeys.map((m) => m.toBase58()),
                    transaction: createResult.data.transactionSignature,
                  },
                  null,
                  2
                ) +
                "\n\nSuggestion: Use 'multisigInfo' to view details about your new multisig",
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to create multisig: ${error}\n\nSuggestion: Check your network connection and wallet balance`,
            },
          ],
        };
      }
    }
  );

  server.tool(
    "getMultisigAddress",
    "Gets the currently configured standalone multisig address",
    {},
    async () => {
      try {
        // Get currently configured multisig
        const multisigRes = await ConfigService.getActiveSquadsMultisig();
        if (!multisigRes.success || !multisigRes.data) {
          return {
            content: [
              {
                type: "text",
                text: "No standalone multisig configured. Use setMultisigAddress to configure one.",
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: `Current standalone multisig: ${multisigRes.data}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting multisig address: ${error}`,
            },
          ],
        };
      }
    }
  );

  server.tool(
    "fundSolanaToMultisig",
    "Fund the multisig with SOL",
    {
      amount: z.number(),
    },
    async ({ amount }) => {
      try {
        // Use context hook to get connection and multisig address
        const context = await useMcpContext({
          requireWallet: true,
          requireMultisig: true,
        });

        if (!context.success) {
          return {
            content: [
              {
                type: "text",
                text: context.error || "Failed to get multisig context",
              },
            ],
          };
        }

        const { connection, keypair, multisigAddress } = context;

        // Fund the multisig with SOL
        const fundRes = await MultisigService.fundSolanaToMultisig(
          connection,
          keypair,
          multisigAddress!,
          amount
        );

        if (!fundRes.success) {
          return {
            content: [
              {
                type: "text",
                text: `Failed to fund multisig: ${fundRes.error?.message}\n\nSuggestion: Ensure you have enough SOL in your wallet to cover both the amount and transaction fees`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: `Successfully funded multisig with ${amount} SOL!\n\nSuggestion: Use 'multisigInfo' to view the updated balance of your multisig vault`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to fund multisig: ${error}\n\nSuggestion: Check your network connection and wallet balance. You must have more SOL than the amount you're trying to fund plus fees.`,
            },
          ],
        };
      }
    }
  );

  server.tool(
    "setMultisigAddress",
    "Sets the active standalone multisig address",
    {
      address: z.string().min(32).max(44),
    },
    async ({ address }) => {
      try {
        // Validate the address
        let multisigAddress: PublicKey;
        try {
          multisigAddress = new PublicKey(address);
        } catch (e) {
          return {
            content: [
              {
                type: "text",
                text: "Invalid multisig address.\n\nSuggestion: Use a valid Solana address, or create a new multisig with 'createMultisig'",
              },
            ],
          };
        }

        // Get connection using the context hook
        const context = await useMcpContext({ requireWallet: false });
        if (!context.success) {
          return {
            content: [
              {
                type: "text",
                text: context.error || "Failed to establish connection",
              },
            ],
          };
        }

        const connection = context.connection;

        // Verify this is a valid multisig
        const multisigInfoRes = await MultisigService.getMultisigInfo(
          connection,
          multisigAddress
        );

        if (!multisigInfoRes.success || !multisigInfoRes.data) {
          return {
            content: [
              {
                type: "text",
                text: "This doesn't appear to be a valid Squads multisig address.",
              },
            ],
          };
        }

        // Set as active multisig
        const configRes = await ConfigService.setActiveSquadsMultisig(address);
        if (!configRes.success) {
          return {
            content: [
              {
                type: "text",
                text: `Failed to set multisig address: ${configRes.error?.message}`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: `Successfully set standalone multisig to: ${address}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to set multisig address: ${error}\n\nSuggestion: Try 'createMultisig' to create a new multisig instead`,
            },
          ],
        };
      }
    }
  );

  server.tool(
    "multisigInfo",
    "Get information about the configured standalone multisig",
    {},
    async () => {
      try {
        // Use context hook to get connection and multisig address
        const context = await useMcpContext({ requireMultisig: true });
        if (!context.success) {
          return {
            content: [
              {
                type: "text",
                text: context.error || "Failed to get multisig context",
              },
            ],
          };
        }

        const { connection, multisigAddress } = context;

        // Get multisig info
        const multisigInfoRes = await MultisigService.getMultisigInfo(
          connection,
          multisigAddress!
        );

        if (!multisigInfoRes.success || !multisigInfoRes.data) {
          return {
            content: [
              {
                type: "text",
                text: `Failed to retrieve multisig info: ${multisigInfoRes.error?.message}`,
              },
            ],
          };
        }

        // Get vault info
        const vaultPdaRes = MultisigService.getMultisigVaultPda(
          multisigAddress!
        );
        if (!vaultPdaRes.success || !vaultPdaRes.data) {
          return {
            content: [
              {
                type: "text",
                text: `Failed to get vault info: ${vaultPdaRes.error?.message}`,
              },
            ],
          };
        }

        // Get balance
        const vaultBalance = await connection.getBalance(vaultPdaRes.data);

        // Format the response
        const info = multisigInfoRes.data;
        const result = {
          address: multisigAddress!.toBase58(),
          vault: vaultPdaRes.data.toBase58(),
          vaultBalance: `${vaultBalance / LAMPORTS_PER_SOL} SOL`,
          members: (info.members || []).map((m) => m.toBase58()),
          memberCount: info.memberCount,
          threshold: info.threshold,
          transactionIndex: info.transactionIndex,
        };

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            { type: "text", text: `Failed to get multisig info: ${error}` },
          ],
        };
      }
    }
  );

  server.tool(
    "createMultisigTransaction",
    "Create a transaction for the standalone multisig",
    {
      recipient: z.string(),
      amount: z.number(),
      title: z.string().optional().default("SOL Transfer"),
    },
    async ({ recipient, amount, title }) => {
      try {
        // Use context hook to get connection, wallet and multisig address
        const context = await useMcpContext({
          requireWallet: true,
          requireMultisig: true,
        });

        if (!context.success) {
          return {
            content: [
              {
                type: "text",
                text: context.error || "Failed to get multisig context",
              },
            ],
          };
        }

        const { connection, keypair, multisigAddress } = context;

        // Parse recipient
        let recipientAddress: PublicKey;
        try {
          recipientAddress = new PublicKey(recipient);
        } catch (e) {
          return {
            content: [{ type: "text", text: "Invalid recipient address." }],
          };
        }

        // Create SOL transfer instruction
        const transferIxRes =
          await MultisigService.getSquadsMultisigSolTransferInstruction(
            connection,
            multisigAddress!,
            amount,
            recipientAddress
          );

        if (!transferIxRes.success || !transferIxRes.data) {
          return {
            content: [
              {
                type: "text",
                text: `Failed to create transfer instruction: ${transferIxRes.error?.message}`,
              },
            ],
          };
        }

        // Create the transaction with proposal
        const txResult = await MultisigService.createTransactionWithProposal(
          connection,
          multisigAddress!,
          keypair,
          [transferIxRes.data],
          title
        );

        if (!txResult.success || !txResult.data) {
          return {
            content: [
              {
                type: "text",
                text: `Failed to create multisig transaction: ${txResult.error?.message}`,
              },
            ],
          };
        }

        const result = {
          success: true,
          multisigAddress: multisigAddress!.toBase58(),
          transactionIndex: txResult.data.transactionIndex,
          title: title,
          recipient: recipientAddress.toBase58(),
          amount: amount,
        };

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to create multisig transaction: ${error}`,
            },
          ],
        };
      }
    }
  );

  server.tool(
    "approveMultisigTransaction",
    "Approve a transaction in the standalone multisig",
    {
      transactionIndex: z.number(),
    },
    async ({ transactionIndex }) => {
      try {
        // Use context hook to get connection, wallet and multisig address
        const context = await useMcpContext({
          requireWallet: true,
          requireMultisig: true,
        });

        if (!context.success) {
          return {
            content: [
              {
                type: "text",
                text: context.error || "Failed to get multisig context",
              },
            ],
          };
        }

        const { connection, keypair, multisigAddress } = context;

        // Approve the transaction
        const approveRes = await MultisigService.approveProposal(
          connection,
          keypair,
          multisigAddress!,
          transactionIndex
        );

        if (!approveRes.success) {
          return {
            content: [
              {
                type: "text",
                text: `Failed to approve transaction: ${approveRes.error?.message}`,
              },
            ],
          };
        }

        // Get status after approval
        const statusRes = await MultisigService.getProposalStatus(
          connection,
          multisigAddress!,
          transactionIndex
        );

        let statusInfo = "";
        if (statusRes.success && statusRes.data) {
          statusInfo = `\nCurrent approvals: ${statusRes.data.approvalCount}/${statusRes.data.threshold}`;
          if (statusRes.data.meetsThreshold) {
            statusInfo += "\nTransaction is ready to execute!";
          }
        }

        return {
          content: [
            {
              type: "text",
              text: `Transaction approved successfully! ${statusInfo}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            { type: "text", text: `Failed to approve transaction: ${error}` },
          ],
        };
      }
    }
  );

  server.tool(
    "executeMultisigTransaction",
    "Execute an approved transaction in the standalone multisig",
    {
      transactionIndex: z.number(),
    },
    async ({ transactionIndex }) => {
      try {
        // Use context hook to get connection, wallet and multisig address
        const context = await useMcpContext({
          requireWallet: true,
          requireMultisig: true,
        });

        if (!context.success) {
          return {
            content: [
              {
                type: "text",
                text: context.error || "Failed to get multisig context",
              },
            ],
          };
        }

        const { connection, keypair, multisigAddress } = context;

        // Execute the transaction
        const executeRes = await MultisigService.executeMultisigTransaction(
          connection,
          keypair,
          multisigAddress!,
          transactionIndex
        );

        if (!executeRes.success) {
          return {
            content: [
              {
                type: "text",
                text: `Failed to execute transaction: ${executeRes.error?.message}`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: `Transaction executed successfully!\nTx Signature: ${executeRes.data}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            { type: "text", text: `Failed to execute transaction: ${error}` },
          ],
        };
      }
    }
  );
}
