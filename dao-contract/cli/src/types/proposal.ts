import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
export interface Proposal {
  proposalId: string;
  description: string;
  targetAmount: BN;
  targetAccount: PublicKey;
  mint: PublicKey;
}
