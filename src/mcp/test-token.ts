import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  createAssociatedTokenAccount,
  createMint,
  getMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import { WalletService } from "../services/wallet-service";
import { ConnectionService } from "../services/connection-service";
import { PublicKey } from "@solana/web3.js";
export function registerTestTokenTools(server: McpServer) {
  // Get Test Token
  server.tool(
    "getTestToken",
    "Get test token",
    {
      decimals: z.number().optional(),
      amountToMint: z.number().optional(),
    },
    async ({ decimals, amountToMint }) => {
      try {
        const connectionRes = await ConnectionService.getConnection();
        if (!connectionRes.success || !connectionRes.data) {
          return {
            content: [
              { type: "text" as const, text: "Connection not established" },
            ],
          };
        }
        const walletRes = await WalletService.loadWallet();
        if (!walletRes.success || !walletRes.data) {
          return {
            content: [{ type: "text" as const, text: "Wallet not loaded" }],
          };
        }
        const connection = connectionRes.data;
        const wallet = walletRes.data;
        const decimalsOfToken = decimals ? decimals : 6;
        const keypair = WalletService.getKeypair(wallet);
        const testToken = await createMint(
          connection,
          keypair,
          keypair.publicKey,
          null,
          decimalsOfToken
        );
        const amountToMintToken = amountToMint ? amountToMint : 10;
        const receipientTokenAccount = await createAssociatedTokenAccount(
          connection,
          keypair,
          testToken,
          keypair.publicKey
        );
        const tx = await mintTo(
          connection,
          keypair,
          testToken,
          receipientTokenAccount,
          keypair.publicKey,
          amountToMintToken * 10 ** decimalsOfToken
        );
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  mint: testToken,
                  receipientTokenAccount,
                  transaction: tx,
                  amountMinted: amountToMintToken,
                  decimals: decimalsOfToken,
                },
                null,
                0
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            { type: "text", text: `Error: ${(error as Error).message}` },
          ],
        };
      }
    }
  );

  // mint more test token
  server.tool(
    "mintMoreTestToken",
    "Mint more test token",
    {
      mint: z.string(),
      receipint: z.string().optional(),
      amountToMint: z.number(),
    },
    async ({ mint, receipint, amountToMint }) => {
      try {
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
        const mintInfo = await getMint(connectionRes.data, new PublicKey(mint));
        if (!mintInfo) {
          return {
            content: [{ type: "text", text: "Mint not found" }],
          };
        }
        const connection = connectionRes.data;
        const wallet = walletRes.data;
        const keypair = WalletService.getKeypair(wallet);
        const mintPubkey = new PublicKey(mint);
        const receipintPubkey = receipint
          ? new PublicKey(receipint)
          : keypair.publicKey;
        const receipientTokenAccount = await getOrCreateAssociatedTokenAccount(
          connection,
          keypair,
          mintPubkey,
          receipintPubkey,
          true
        );

        const tx = await mintTo(
          connection,
          keypair,
          mintPubkey,
          receipientTokenAccount.address,
          keypair.publicKey,
          amountToMint * 10 ** mintInfo.decimals
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  mint: mint,
                  receipient: receipintPubkey.toBase58(),
                  receipientTokenAccount:
                    receipientTokenAccount.address.toBase58(),
                  amountInReceipientTokenAccount:
                    receipientTokenAccount.amount.toString(),
                  transaction: tx,
                  amountMinted: amountToMint,
                },
                null,
                0
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            { type: "text", text: `Error: ${(error as Error).message}` },
          ],
        };
      }
    }
  );
}
