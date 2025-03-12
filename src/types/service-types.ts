import { PublicKey } from "@solana/web3.js";

/**
 * Standard response format for all services
 */
export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string | number;
    details?: any;
  };
}

/**
 * Wallet information response data
 */
export interface WalletData {
  pubkey: string;
  balance?: number;
  network?: string;
}

/**
 * DAO information response data
 */
export interface DaoData {
  name: string;
  realmAddress: PublicKey;
  governanceAddress: PublicKey;
  treasuryAddress: PublicKey;
  isIntegrated: boolean;
  multisigAddress?: PublicKey;
  vaultAddress?: PublicKey;
  treasuryBalance?: number;
  vaultBalance?: number;
}

/**
 * Multisig information response data
 */
export interface MultisigData {
  multisigPda: PublicKey;
  threshold: number;
  memberCount: number;
  transactionIndex?: number;
  members?: PublicKey[];
}

/**
 * Proposal information response data
 */
export interface ProposalData {
  address: PublicKey;
  title: string;
  description: string;
  state: string;
  votingEndsAt?: Date;
  isExecutable?: boolean;
  multisigInfo?: {
    multisigAddress?: PublicKey;
    transactionIndex?: number;
  };
}
