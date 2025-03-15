import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  ACTIONS,
  Action,
  SolanaAgentKit,
  zodToMCPShape,
} from "solana-agent-kit";
import pkg from "bs58";
const { encode } = pkg;
import { ConnectionService } from "../services/connection-service";
import { WalletService } from "../services/wallet-service";

export async function registerAgentTools(server: McpServer) {
  const registerActions: Record<string, Action> = {
    getBalance: ACTIONS.BALANCE_ACTION,
    getWalletAddress: ACTIONS.WALLET_ADDRESS_ACTION,
    getTps: ACTIONS.GET_TPS_ACTION,
    getTokenBalances: ACTIONS.TOKEN_BALANCES_ACTION,
    getTokenInfo: ACTIONS.GET_TOKEN_DATA_ACTION,
    airdrop: ACTIONS.REQUEST_FUNDS_ACTION,
  };
  for (const [_key, action] of Object.entries(registerActions)) {
    const { result } = zodToMCPShape(action.schema);
    server.tool(action.name, action.description, result, async (params) => {
      try {
        const connection = await ConnectionService.getConnection();
        if (!connection.success || !connection.data) {
          return {
            content: [{ type: "text", text: "Connection failed" }],
          };
        }
        const walletRes = await WalletService.loadWallet();
        if (!walletRes.success || !walletRes.data) {
          return {
            content: [{ type: "text", text: "Wallet not loaded" }],
          };
        }
        const wallet = walletRes.data;
        const keypair = WalletService.getKeypair(wallet);
        const solanaAgentKit = new SolanaAgentKit(
          encode(keypair.secretKey),
          connection.data.rpcEndpoint,
          {}
        );
        const res = await action.handler(solanaAgentKit, params);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(res, null, 0),
            },
          ],
        };
      } catch (e) {
        return {
          content: [{ type: "text", text: `Err: ${e}` }],
        };
      }
    });
  }
}
