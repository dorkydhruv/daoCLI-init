import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerDaoTools } from "./mcp/dao";
import { registerConfigAndWalletTools } from "./mcp/config-and-wallet";
import { registerProposalTools } from "./mcp/proposal";
import { z } from "zod";
import { ConnectionService } from "./services/connection-service";
import { registerResource } from "./mcp/resource";
import { registerAgentTools } from "./mcp/agent-tools";

const server = new McpServer({
  name: "DaoCLI",
  version: "0.0.1",
});

registerConfigAndWalletTools(server);
registerDaoTools(server);
registerProposalTools(server);
registerResource(server);
registerAgentTools(server);
// // Get Transaction
server.tool(
  "getTransaction",
  "Used to look up transaction by signature (64 byte base58 encoded string)",
  { signature: z.string() },
  async ({ signature }) => {
    try {
      const connectionRes = await ConnectionService.getConnection();
      if (!connectionRes.success || !connectionRes.data) {
        return {
          content: [{ type: "text", text: "Connection not established" }],
        };
      }
      const connection = connectionRes.data;
      const transaction = await connection.getParsedTransaction(signature, {
        maxSupportedTransactionVersion: 0,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(transaction, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${(error as Error).message}` }],
      };
    }
  }
);

server.prompt(
  "what-happened-in-transaction",
  "Look up the given transaction and inspect its logs & instructions to figure out what happened",
  { signature: z.string() },
  ({ signature }) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Look up the transaction with signature ${signature} and inspect its logs & instructions to figure out what happened.`,
        },
      },
    ],
  })
);

const transport = new StdioServerTransport();
server.connect(transport);
