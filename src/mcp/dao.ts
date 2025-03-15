import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ConnectionService } from "../services/connection-service";
import { ConfigService } from "../services/config-service";
import { WalletService } from "../services/wallet-service";
import { PublicKey } from "@solana/web3.js";
import { GovernanceService } from "../services/governance-service";
import { MultisigService } from "../services/multisig-service";

export function registerDaoTools(server: McpServer) {
  server.tool(
    "createDao",
    "Used to create a DAO either an integrated Multisig DAO or a standard multisig DAO",
    {
      integrated: z.boolean(),
      name: z.string(),
      members: z.array(z.string()),
      threshold: z.number(),
    },
    async ({ integrated, name, members, threshold }) => {
      const connectionRes = await ConnectionService.getConnection();
      if (!connectionRes.success || !connectionRes.data) {
        return {
          content: [{ type: "text", text: "Connection not established" }],
        };
      }
      const walletRes = await WalletService.loadWallet();
      if (!walletRes.success || !walletRes.data) {
        return {
          content: [{ type: "text", text: "Wallet not loaded" }],
        };
      }
      const connection = connectionRes.data;
      const wallet = walletRes.data;
      const keypair = WalletService.getKeypair(wallet);
      const membersPubkeys: PublicKey[] = [keypair.publicKey];
      for (const member of members) {
        try {
          if (member !== keypair.publicKey.toBase58())
            membersPubkeys.push(new PublicKey(member));
        } catch (e) {
          // Do nothing
        }
      }
      if (membersPubkeys.length < threshold) {
        return {
          content: [
            {
              type: "text",
              text: "Threshold should be less than or equal to number of members",
            },
          ],
        };
      }

      // Use different initialization functions based on integration mode
      let daoResult;
      if (integrated) {
        // Use integrated DAO creation
        daoResult = await GovernanceService.initializeIntegratedDAO(
          connection,
          keypair,
          name,
          membersPubkeys,
          threshold
        );
      } else {
        daoResult = await GovernanceService.initializeDAO(
          connection,
          keypair,
          name,
          membersPubkeys,
          threshold
        );
      }

      if (!daoResult.success || !daoResult.data) {
        return {
          content: [
            { type: "text", text: JSON.stringify(daoResult.error, null) },
          ],
        };
      }

      // Store the realm address in config
      const configResult = await ConfigService.setActiveRealm(
        daoResult.data.realmAddress.toBase58()
      );
      if (!configResult.success) {
        return {
          content: [
            { type: "text", text: JSON.stringify(configResult.error, null) },
          ],
        };
      }

      // Format response based on DAO type
      let result;
      if (integrated) {
        result = {
          success: true,
          dao: {
            realmAddress: daoResult.data.realmAddress.toBase58(),
            governanceAddress: daoResult.data.governanceAddress.toBase58(),
            treasuryAddress: daoResult.data.treasuryAddress.toBase58(),
            communityMint: daoResult.data.communityMint.toBase58(),
            councilMint: daoResult.data.councilMint.toBase58(),
            //@ts-ignore
            transaction: daoResult.data.daoTransaction,
          },
          squadMultisig: {
            //@ts-ignore
            multisigAddress: daoResult.data.multisigAddress.toBase58(),
            //@ts-ignore
            transaction: daoResult.data.squadsTransaction,
          },
        };
      } else {
        result = {
          success: true,
          dao: {
            realmAddress: daoResult.data.realmAddress.toBase58(),
            governanceAddress: daoResult.data.governanceAddress.toBase58(),
            treasuryAddress: daoResult.data.treasuryAddress.toBase58(),
            communityMint: daoResult.data.communityMint.toBase58(),
            councilMint: daoResult.data.councilMint.toBase58(),
            //@ts-ignore
            transaction: daoResult.data.transactionSignature,
          },
          squadMultisig: null,
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  server.tool(
    "showDao",
    "Displays the current DAO configuration and info",
    {},
    async () => {
      const connectionRes = await ConnectionService.getConnection();
      if (!connectionRes.success || !connectionRes.data) {
        return {
          content: [{ type: "text", text: "Connection not established" }],
        };
      }
      const connection = connectionRes.data;
      const configRes = await ConfigService.getConfig();
      if (
        !configRes.success ||
        !configRes.data ||
        !configRes.data.dao?.activeRealm
      ) {
        return {
          content: [
            {
              type: "text",
              text: "Config not loaded or Realm not configured.\n First configure to use a realm",
            },
          ],
        };
      }
      const realmAddress = new PublicKey(configRes.data.dao?.activeRealm);
      const realmInfoRes = await GovernanceService.getRealmInfo(
        connection,
        realmAddress
      );
      if (!realmInfoRes.success || !realmInfoRes.data) {
        return {
          content: [
            {
              type: "text",
              text: "Failed to get realm info",
            },
          ],
        };
      }
      const realmInfo = realmInfoRes.data;
      return {
        content: [{ type: "text", text: JSON.stringify(realmInfo, null, 2) }],
      };
    }
  );

  server.tool(
    "fundSolana",
    "Fund native Solana to the current multisig DAO treasury. This is used to fund the DAO",
    {
      amount: z.number(),
    },
    async ({ amount }) => {
      // Load wallet and connection
      const walletRes = await WalletService.loadWallet();
      if (!walletRes.success || !walletRes.data) {
        return {
          content: [
            {
              type: "text",
              text: "No wallet configured. Please create a wallet first.",
            },
          ],
        };
      }

      // Check config
      const configRes = await ConfigService.getConfig();
      if (
        !configRes.success ||
        !configRes.data ||
        !configRes.data.dao?.activeRealm
      ) {
        return {
          content: [
            {
              type: "text",
              text: "No DAO configured. Use setActiveRealm to select one.",
            },
          ],
        };
      }

      const connectionRes = await ConnectionService.getConnection();
      if (!connectionRes.success || !connectionRes.data) {
        return {
          content: [{ type: "text", text: "Failed to establish connection" }],
        };
      }

      const connection = connectionRes.data;
      const keypair = WalletService.getKeypair(walletRes.data);
      const realmAddress = new PublicKey(configRes.data.dao.activeRealm);

      // Validate amount
      if (isNaN(amount) || amount <= 0) {
        return {
          content: [
            {
              type: "text",
              text: "Invalid amount. Please provide a positive number.",
            },
          ],
        };
      }

      // Get DAO info to determine where to send funds
      const realmInfoRes = await GovernanceService.getRealmInfo(
        connection,
        realmAddress
      );
      if (!realmInfoRes.success || !realmInfoRes.data) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to get DAO information: ${realmInfoRes.error?.message}`,
            },
          ],
        };
      }

      const realmInfo = realmInfoRes.data;

      // Determine target based on whether this is an integrated DAO
      let targetAddress: PublicKey;
      let targetType: string;

      if (realmInfo.isIntegrated && realmInfo.vaultAddress) {
        // For integrated DAOs, fund the multisig vault
        targetAddress = realmInfo.vaultAddress;
        targetType = "Squads multisig vault";
      } else {
        // For standard DAOs, fund the treasury
        targetAddress = realmInfo.treasuryAddress;
        targetType = "native treasury";
      }

      // Fund target
      const fundRes = await GovernanceService.fundTreasury(
        connection,
        keypair,
        targetAddress,
        amount
      );

      if (!fundRes.success) {
        return {
          content: [
            { type: "text", text: `Failed to fund: ${fundRes.error?.message}` },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `Successfully funded ${targetType} with ${amount} SOL!\nTransaction: ${fundRes.data}`,
          },
        ],
      };
    }
  );

  server.tool(
    "useDao",
    "Set active DAO by realm address",
    {
      address: z.string(),
    },
    async ({ address }) => {
      try {
        let realmAddress: PublicKey;

        try {
          realmAddress = new PublicKey(address);
        } catch (e) {
          return {
            content: [{ type: "text", text: "Invalid realm address" }],
          };
        }

        const connectionRes = await ConnectionService.getConnection();
        if (!connectionRes.success || !connectionRes.data) {
          return {
            content: [{ type: "text", text: "Failed to establish connection" }],
          };
        }

        const connection = connectionRes.data;

        // Get information about the realm
        const realmInfoRes = await GovernanceService.getRealmInfo(
          connection,
          realmAddress
        );
        if (!realmInfoRes.success || !realmInfoRes.data) {
          return {
            content: [
              {
                type: "text",
                text: `Could not find realm at address: ${realmAddress.toBase58()}`,
              },
            ],
          };
        }

        // Store only the realm address in config
        const configRes = await ConfigService.setActiveRealm(
          realmAddress.toBase58()
        );
        if (!configRes.success) {
          return {
            content: [
              {
                type: "text",
                text: `Failed to save realm address to config: ${configRes.error?.message}`,
              },
            ],
          };
        }

        const realmInfo = realmInfoRes.data;
        const result = {
          address: realmAddress.toBase58(),
          name: realmInfo.name,
          governanceAddress: realmInfo.governanceAddress.toBase58(),
          treasuryAddress: realmInfo.treasuryAddress.toBase58(),
          isIntegrated: realmInfo.isIntegrated,
          multisigAddress: realmInfo.multisigAddress?.toBase58(),
          vaultAddress: realmInfo.vaultAddress?.toBase58(),
        };

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            { type: "text", text: `Failed to set active DAO: ${error}` },
          ],
        };
      }
    }
  );

  server.tool(
    "listDaos",
    "List all DAOs where you are a member",
    {},
    async () => {
      try {
        // Load wallet and connection
        const walletRes = await WalletService.loadWallet();
        if (!walletRes.success || !walletRes.data) {
          return {
            content: [
              {
                type: "text",
                text: "No wallet configured. Please create a wallet first.",
              },
            ],
          };
        }

        const connectionRes = await ConnectionService.getConnection();
        if (!connectionRes.success || !connectionRes.data) {
          return {
            content: [{ type: "text", text: "Failed to establish connection" }],
          };
        }

        const connection = connectionRes.data;
        const keypair = WalletService.getKeypair(walletRes.data);

        // Use the new getTokenOwnerRecords function to find all realms where the user is a member
        const tokenOwnerRecordsRes =
          await GovernanceService.getTokenOwnerRecords(connection, keypair);

        if (!tokenOwnerRecordsRes.success || !tokenOwnerRecordsRes.data) {
          return {
            content: [
              {
                type: "text",
                text: `Failed to fetch token owner records: ${tokenOwnerRecordsRes.error?.message}`,
              },
            ],
          };
        }

        const tokenOwnerRecords = tokenOwnerRecordsRes.data;

        if (tokenOwnerRecords.length === 0) {
          return {
            content: [
              { type: "text", text: JSON.stringify({ daos: [] }, null, 2) },
            ],
          };
        }

        // Get realm information for each token owner record
        const realmDataPromises = tokenOwnerRecords.map(
          async (record, index) => {
            try {
              // Get realm info
              const realmInfoRes = await GovernanceService.getRealmInfo(
                connection,
                record.realmAddress
              );

              if (!realmInfoRes.success || !realmInfoRes.data) {
                return {
                  index: index + 1,
                  name: "Unknown",
                  type: record.isIntegrated ? "Integrated" : "Standard",
                  address: record.realmAddress.toBase58(),
                  tokens:
                    record.tokenOwnerRecords.governingTokenDepositAmount.toString(),
                };
              }

              return {
                index: index + 1,
                name: realmInfoRes.data.name,
                type: record.isIntegrated ? "Integrated" : "Standard",
                address: record.realmAddress.toBase58(),
                tokens:
                  record.tokenOwnerRecords.governingTokenDepositAmount.toString(),
                governance: realmInfoRes.data.governanceAddress.toBase58(),
                treasury: realmInfoRes.data.treasuryAddress.toBase58(),
                multisig: realmInfoRes.data.multisigAddress?.toBase58(),
                vault: realmInfoRes.data.vaultAddress?.toBase58(),
              };
            } catch (error) {
              return {
                index: index + 1,
                name: "Error",
                type: "Unknown",
                address: record.realmAddress.toBase58(),
                tokens: "0",
              };
            }
          }
        );

        const processedRealms = await Promise.all(realmDataPromises);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ daos: processedRealms }, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Failed to list DAOs: ${error}` }],
        };
      }
    }
  );

  server.tool(
    "fundToken",
    "Fund token accounts for the active DAO",
    {
      mint: z.string(),
      amount: z.number().optional().default(100),
      recipient: z.string().optional(),
    },
    async ({ mint, amount, recipient }) => {
      try {
        // Load wallet and connection
        const walletRes = await WalletService.loadWallet();
        if (!walletRes.success || !walletRes.data) {
          return {
            content: [
              {
                type: "text",
                text: "No wallet configured. Please create a wallet first.",
              },
            ],
          };
        }

        // Check config
        const configRes = await ConfigService.getConfig();
        if (
          !configRes.success ||
          !configRes.data ||
          !configRes.data.dao?.activeRealm
        ) {
          return {
            content: [
              {
                type: "text",
                text: "No DAO configured. Use useDao to select one.",
              },
            ],
          };
        }

        // Check mint address
        if (!mint) {
          return {
            content: [{ type: "text", text: "Token mint address is required" }],
          };
        }

        const connectionRes = await ConnectionService.getConnection();
        if (!connectionRes.success || !connectionRes.data) {
          return {
            content: [{ type: "text", text: "Failed to establish connection" }],
          };
        }

        const connection = connectionRes.data;
        const keypair = WalletService.getKeypair(walletRes.data);
        const realmAddress = new PublicKey(configRes.data.dao.activeRealm);

        // Parse token mint
        let tokenMint: PublicKey;
        try {
          tokenMint = new PublicKey(mint);
        } catch (e) {
          return {
            content: [{ type: "text", text: "Invalid token mint address" }],
          };
        }

        // Validate amount
        if (isNaN(amount) || amount <= 0) {
          return {
            content: [
              {
                type: "text",
                text: "Invalid amount. Please provide a positive number.",
              },
            ],
          };
        }

        // Get DAO info
        const realmInfoRes = await GovernanceService.getRealmInfo(
          connection,
          realmAddress
        );
        if (!realmInfoRes.success || !realmInfoRes.data) {
          return {
            content: [
              {
                type: "text",
                text: `Failed to get DAO information: ${realmInfoRes.error?.message}`,
              },
            ],
          };
        }

        const realmInfo = realmInfoRes.data;

        // Determine recipient address
        let recipientAddress: PublicKey;
        let recipientType: string;

        if (recipient) {
          try {
            recipientAddress = new PublicKey(recipient);
            recipientType = "custom";
          } catch (e) {
            return {
              content: [{ type: "text", text: "Invalid recipient address" }],
            };
          }
        } else {
          // Use the appropriate treasury based on DAO type
          if (realmInfo.isIntegrated && realmInfo.vaultAddress) {
            recipientAddress = realmInfo.vaultAddress;
            recipientType = "multisig_vault";
          } else {
            recipientAddress = realmInfo.treasuryAddress;
            recipientType = "dao_treasury";
          }
        }

        // Fund token account
        const fundRes = await GovernanceService.fundTokenAccount(
          connection,
          keypair,
          tokenMint,
          recipientAddress,
          amount
        );

        if (!fundRes.success) {
          return {
            content: [
              {
                type: "text",
                text: `Failed to fund token account: ${fundRes.error?.message}`,
              },
            ],
          };
        }

        const result = {
          success: true,
          mint: mint,
          amount: amount,
          recipient: recipientAddress.toBase58(),
          recipientType: recipientType,
          transaction: fundRes.data,
        };

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            { type: "text", text: `Failed to fund token account: ${error}` },
          ],
        };
      }
    }
  );
}
