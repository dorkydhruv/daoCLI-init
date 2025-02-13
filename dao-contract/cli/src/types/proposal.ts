import { PublicKey } from "@solana/web3.js";
export interface Proposal {
  proposalId: string;
  description: string;
  targetAmount: number;
  targetAccount: PublicKey;
  mint: PublicKey;
}
