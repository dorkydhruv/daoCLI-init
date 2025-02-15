import { loadConfig } from "../load-config";
import { SolanaClientAgent } from "./solana-client-agent";
import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { writeFileSync } from "fs";
import { resolve } from "path";

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

  static async getTestInstance(): Promise<SolanaClientAgent> {
    const network: "devnet" = "devnet";
    const devnetRPC = "https://api.devnet.solana.com";
    const connection = new Connection(devnetRPC, "confirmed");
    const testKeypair = Keypair.generate();
    // Request airdrop
    const airdropSig = await connection.requestAirdrop(
      testKeypair.publicKey,
      3 * LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(airdropSig);
    // Update keypair file so spawnSync uses the new signer
    const config = loadConfig();
    console.log(`Switching to ${network}`);
    const keypairPath = resolve(process.cwd(), config.keypairPaths[network]);
    console.log(`Writing keypair to ${keypairPath}`);
    writeFileSync(
      keypairPath,
      JSON.stringify(Array.from(testKeypair.secretKey))
    );
    AgentManager.instance = new SolanaClientAgent(
      network,
      config.keypairPaths[network],
      testKeypair
    );
    return AgentManager.instance;
  }
}

export { AgentManager };
