import { Proposal } from "../types/proposal";
import { getMint, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import * as anchor from "@coral-xyz/anchor";
import { AgentManager } from "../lib/agent";
import { ASSOCIATED_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/utils/token";
export async function createProposal(proposal: Proposal) {
  const agent = AgentManager.getInstance();
  const [proposalAccount, _] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("proposal"),
      Buffer.from(proposal.proposalId),
      agent.wallet.publicKey.toBuffer(),
    ],
    agent.program.programId
  );
  const mint = await getMint(agent.program.provider.connection, proposal.mint);
  const tx = await agent.program.methods
    .createProposal(
      proposal.proposalId,
      proposal.description,
      new anchor.BN(proposal.targetAmount * 10 ** mint.decimals),
      proposal.targetAccount
    )
    .accountsPartial({
      payer: agent.program.provider.publicKey,
      proposal: proposalAccount,
      token: proposal.mint,
      associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .rpc();
  console.log(`Proposal created with publickey ${proposalAccount}`);
  console.log(
    `Transaction hash: https://explorer.solana.com/tx/${tx}?cluster=${agent.network}`
  );
}
