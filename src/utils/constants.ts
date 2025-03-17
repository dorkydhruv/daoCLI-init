import { Cluster } from "@solana/web3.js";
import path from "path";
import os from "os";

// Platform-agnostic config directory
// function getConfigDirectory(): string {
//   const homeDir = os.homedir();
//   const platform = process.platform;

//   // Windows: %APPDATA%\dao-cli
//   if (platform === "win32") {
//     return path.join(homeDir, "AppData", "Roaming", "dao-cli");
//   }

//   // macOS: ~/Library/Application Support/dao-cli
//   if (platform === "darwin") {
//     return path.join(homeDir, "Library", "Application Support", "dao-cli");
//   }

//   // Linux/Unix: ~/.config/dao-cli
//   return path.join(homeDir, ".config", "dao-cli");
// }

// Config paths
export const CONFIG_DIR = path.join(os.homedir(), ".config", "dao-cli");
export const WALLET_PATH = path.join(CONFIG_DIR, "wallet.json");
export const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");

// Network constants
export const CLUSTERS: Record<string, Cluster> = {
  mainnet: "mainnet-beta",
  devnet: "devnet",
  localhost: "testnet",
};

export const DEFAULT_CLUSTER = "testnet" as Cluster;
export const ENDPOINT_MAP: Record<Cluster, string> = {
  "mainnet-beta": "https://api.mainnet-beta.solana.com",
  devnet: "https://api.devnet.solana.com",
  testnet: "http://localhost:8899", // Custom testnet cluster
};

export const ENDPOINT_LOCALHOST = "http://localhost:8899";

// Governance constants
export const SPL_GOVERNANCE_PROGRAM_ID =
  "GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw";
export const SQDS_PROGRAM_ID = "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf";
