import { PublicKey } from "@solana/web3.js";
import { Cluster } from "@solana/web3.js";
import BN from "bn.js";

export interface WalletConfig {
  keypair: number[]; // Serialized keypair
  pubkey: string;
}

export interface DaoConfig {
  activeRealm?: string;
  activeMultisig?: string; // For backwards compatibility
  cluster: Cluster;
  endpoint: string;
}

export interface SquadsMultisigConfig {
  activeAddress?: string;
  // Could add more multisig-specific config options in the future
}

export interface Config {
  wallet?: WalletConfig;
  dao?: DaoConfig;
  squadsMultisig?: SquadsMultisigConfig; // Separate top-level config
}

export interface CommandOptions {
  cluster?: Cluster;
  endpoint?: string;
  keypair?: string;
}

export interface PriorityFeeResponse {
  jsonrpc: string;
  id: string;
  method: string;
  params: Array<{
    transaction: string;
    options: { priorityLevel: string };
  }>;
}

export interface WalletData {
  privateKey: string;
}

export interface BondingCurveInitParams {
  initialVirtualTokenReserves?: BN;
  initialVirtualSolReserves?: BN;
  initialRealTokenReserves?: BN;
  tokenTotalSupply?: BN;
  mintDecimals?: number;
  migrateFeeAmount?: BN;
  feeReceiver?: PublicKey;
  status?:
    | { running: {} }
    | { swapOnly: {} }
    | { swapOnlyNoLaunch: {} }
    | { paused: {} };
  whitelistEnabled?: boolean;
}

export interface CreateBondingCurveParams {
  name: string;
  symbol: string;
  uri: string;
  startTime?: number; // Optional timestamp
  solRaiseTarget: BN;
  // DAO proposal data
  daoName: string;
  daoDescription: string;
  realmAddress: PublicKey;
  twitterHandle?: string;
  discordLink?: string;
  websiteUrl?: string;
  logoUri?: string;
  founderName?: string;
  founderTwitter?: string;
  bullishThesis?: string;
}

export interface SwapParams {
  baseIn: boolean; // true for selling tokens, false for buying tokens
  amount: BN;
  minOutAmount: BN;
}
