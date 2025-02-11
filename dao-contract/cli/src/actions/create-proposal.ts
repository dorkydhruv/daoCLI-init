import { Proposal } from "../types/proposal";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
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
  await agent.program.methods
    .createProposal(
      proposal.proposalId,
      proposal.description,
      proposal.targetAmount,
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
  const accountData = await agent.program.account.proposal.fetch(
    proposalAccount
  );
  console.log(`Proposal created with publickey ${proposalAccount}`);
  console.log(accountData);
}

//5ZitPreB9gJqZqhKrDTcBstUcA7rHth1VFiBcAYeFK7q
