import {
  getOrCreateAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { AgentManager } from "../lib/agent";
import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { ASSOCIATED_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/utils/token";
export async function executeProposal(proposalAccount: PublicKey) {
  // works too, but target amount wasn't met I guess?
  try {
    const agent = AgentManager.getInstance();
    const accountData = await agent.program.account.proposal.fetch(
      proposalAccount
    );
    const proposalTokenAccount = await getOrCreateAssociatedTokenAccount(
      agent.program.provider.connection,
      agent.wallet.payer,
      accountData.token,
      proposalAccount,
      true
    );
    const targetTokenAccount = await getOrCreateAssociatedTokenAccount(
      agent.program.provider.connection,
      agent.wallet.payer,
      accountData.token,
      accountData.targetAccount,
      false
    );
    const tx = await agent.program.methods
      .executeProposal()
      .accountsPartial({
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        token: accountData.token,
        proposal: proposalAccount,
        proposalTokenAccount: proposalTokenAccount.address,
        targetTokenAccount: targetTokenAccount.address,
        targetAccount: accountData.targetAccount,
        associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
        signer: agent.wallet.publicKey,
      })
      .rpc();
    console.log(`Proposal ${proposalAccount} executed successfully`);
    console.log(
      `Transaction hash: https://explorer.solana.com/tx/${tx}?cluster=${agent.network}`
    );
  } catch (err) {
    console.log(`Error executing proposal: ${err}`);
  }
}
