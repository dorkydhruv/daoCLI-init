import { Cluster } from "@solana/web3.js";

export interface WalletConfig {
  keypair: number[]; // Serialized keypair
  pubkey: string;
}

export interface DaoConfig {
  activeRealm?: string;
  governanceAddress?: string;
  treasuryAddress?: string;
  cluster: Cluster;
  endpoint: string;
}

export interface Config {
  wallet?: WalletConfig;
  dao?: DaoConfig;
}

export interface CommandOptions {
  cluster?: Cluster;
  endpoint?: string;
  keypair?: string;
}
