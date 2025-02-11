import { loadConfig } from "../load-config";
import { SolanaClientAgent } from "./solana-client-agent";

class AgentManager {
  private static instance: SolanaClientAgent;

  static getInstance(): SolanaClientAgent {
    if (!AgentManager.instance) {
      const config = loadConfig();
      AgentManager.instance = new SolanaClientAgent(
        config.defaultNetwork as "devnet" | "testnet" | "mainnet",
        config.keypairPaths[
          config.defaultNetwork as "devnet" | "testnet" | "mainnet"
        ]
      );
    }
    return AgentManager.instance;
  }

  static switchNetwork(network: string) {
    const config = loadConfig();
    AgentManager.instance = new SolanaClientAgent(
      network as "devnet" | "testnet" | "mainnet",
      config.keypairPaths[network as "devnet" | "testnet" | "mainnet"]
    );
  }
}

export { AgentManager };
