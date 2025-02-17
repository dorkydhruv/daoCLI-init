import { loadConfig } from "../load-config";
import { SolanaClientAgent } from "./solana-client-agent";
import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { writeFileSync } from "fs";
import { resolve } from "path";

type Network = "devnet" | "testnet" | "mainnet" | "localnet";

class AgentManager {
  private static instance: SolanaClientAgent;

  static getInstance(): SolanaClientAgent {
    if (!AgentManager.instance) {
      const config = loadConfig();
      AgentManager.instance = new SolanaClientAgent(
        config.defaultNetwork as Network,
        config.keypairPaths[config.defaultNetwork as Network]
      );
    }
    return AgentManager.instance;
  }

  static switchNetwork(network: Network) {
    const config = loadConfig();
    if (!config.keypairPaths[network]) {
      throw new Error(`No keypair path configured for network: ${network}`);
    }
    config.defaultNetwork = network;
    writeFileSync(
      resolve(process.cwd(), "dao-config.json"),
      JSON.stringify(config, null, 2)
    );
    AgentManager.instance = new SolanaClientAgent(
      network,
      config.keypairPaths[network]
    );
    console.log(`Successfully switched to ${network}`);
    return AgentManager.instance;
  }

  // static async getTestInstance(): Promise<SolanaClientAgent> {
  //   const network: "devnet" = "devnet";
  //   const devnetRPC = "https://api.devnet.solana.com";
  //   const connection = new Connection(devnetRPC);
  //   const testKeypair = Keypair.generate();
  //   // Request airdrop
  //   const txhash = await connection.requestAirdrop(
  //     testKeypair.publicKey,
  //     2 * LAMPORTS_PER_SOL
  //   );
  //   await connection.confirmTransaction(txhash);
  //   console.log(
  //     `Success! Check out your TX here:  https://explorer.solana.com/tx/${txhash}?cluster=devnet`
  //   );
  //   // Update keypair file so spawnSync uses the new signer
  //   const config = loadConfig();
  //   console.log(`Switching to ${network}`);
  //   const keypairPath = resolve(process.cwd(), config.keypairPaths[network]);
  //   console.log(`Writing keypair to ${keypairPath}`);
  //   writeFileSync(
  //     keypairPath,
  //     JSON.stringify(Array.from(testKeypair.secretKey))
  //   );
  //   AgentManager.instance = new SolanaClientAgent(
  //     network,
  //     config.keypairPaths[network],
  //     testKeypair
  //   );
  //   return AgentManager.instance;
  // }
}

export { AgentManager };
