import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { z } from "zod";
import { ConnectionService } from "./services/connection-service";
import { ConfigService } from "./services/config-service";
import { WalletService } from "./services/wallet-service";
const server = new McpServer({
  name: "DaoCLI",
  version: "0.0.1",
});

server.tool(
  "setCluster",
  "Used to set the cluster to devnet, testnet, or mainnet. Cluster is nothing but the rpc url",
  {
    cluster: z.string(),
  },
  async ({ cluster }) => {
    if (cluster === "devnet") {
      ConfigService.setCluster("devnet");
    } else if (cluster === "testnet") {
      ConfigService.setCluster("testnet");
    } else if (cluster === "mainnet" || cluster === "mainnet-beta") {
      ConfigService.setCluster("mainnet-beta");
    } else {
      return {
        content: [{ type: "text", text: `Invalid cluster: ${cluster}` }],
      };
    }
    return {
      content: [{ type: "text", text: `Cluster set to ${cluster}` }],
    };
  }
);

server.tool(
  "showConfig",
  "Displays the current configuration of the daoCLI",
  {},
  async () => {
    const config = await ConfigService.getConfig();
    return {
      content: [{ type: "text", text: JSON.stringify(config, null, 2) }],
    };
  }
);

server.tool(
  "importWallet",
  "Used to import a wallet from a path/Base64 encoded string",
  {
    wallet: z.string(),
  },
  async ({ wallet }) => {
    const response = await WalletService.importWallet(wallet);
    return {
      content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
    };
  }
);

server.tool("showWallet", "Displays the current wallet", {}, async () => {
  const connection = await ConnectionService.getConnection();
  if (!connection.success || !connection.data) {
    return {
      content: [{ type: "text", text: "Connection not established" }],
    };
  }
  const wallet = await WalletService.getWalletInfo(connection.data);
  return {
    content: [{ type: "text", text: JSON.stringify(wallet, null, 2) }],
  };
});

const transport = new StdioServerTransport();
server.connect(transport);
