import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { z } from "zod";
import { ConnectionService } from "./services/connection-service";
import { ConfigService } from "./services/config-service";
import { WalletService } from "./services/wallet-service";
import { PublicKey } from "@solana/web3.js";
import { GovernanceService } from "./services/governance-service";
import { MultisigService } from "./services/multisig-service";
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
    const daoResult = await GovernanceService.initializeDAO(
      connection,
      keypair,
      name,
      membersPubkeys,
      threshold
    );

    if (!daoResult.success || !daoResult.data) {
      return {
        content: [
          { type: "text", text: JSON.stringify(daoResult.error, null) },
        ],
      };
    }
    let result: {
      dao: any;
      squadMultisig: any;
    } = {
      dao: daoResult.data,
      squadMultisig: null,
    };
    if (integrated) {
      const multisigResult = await MultisigService.createDaoControlledMultisig(
        connection,
        keypair,
        threshold,
        membersPubkeys,
        name,
        daoResult.data.realmAddress
      );
      if (!multisigResult.success || !multisigResult.data) {
        return {
          content: [
            { type: "text", text: JSON.stringify(multisigResult.error, null) },
          ],
        };
      }
      result = {
        ...result,
        squadMultisig: multisigResult.data,
      };
    }
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
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

const transport = new StdioServerTransport();
server.connect(transport);
