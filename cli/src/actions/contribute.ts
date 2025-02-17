import {
  getMint,
  getOrCreateAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { AgentManager } from "../lib/agent";
import { BN } from "bn.js";
import * as anchor from "@coral-xyz/anchor";

export async function contribute(proposalAccount: PublicKey, amount: number) {
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

    const contributorTokenAccount = await getOrCreateAssociatedTokenAccount(
      agent.program.provider.connection,
      agent.wallet.payer,
      accountData.token,
      agent.wallet.publicKey
    );
    const mint = await getMint(
      agent.program.provider.connection,
      accountData.token
    );
    const tx = await agent.program.methods
      .contribute(new BN(amount * Math.pow(10, mint.decimals)))
      .accountsPartial({
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        token: accountData.token,
        contributor: agent.wallet.publicKey,
        contributorTokenAccount: contributorTokenAccount.address,
        proposal: proposalAccount,
        proposalTokenAccount: proposalTokenAccount.address,
      })
      .rpc();
    console.log(
      `Contributed ${amount} (${mint.address}) to proposal ${proposalAccount}`
    );
    console.log(
      `Transaction hash: https://explorer.solana.com/tx/${tx}?cluster=${agent.network}`
    );
  } catch (err) {
    console.log(`Error contributing to proposal: ${err}`);
  }
}
