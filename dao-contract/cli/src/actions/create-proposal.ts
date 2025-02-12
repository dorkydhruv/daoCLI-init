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
  const accountData = await agent.program.account.proposal.fetch(
    proposalAccount
  );
  console.log(`Proposal created with publickey ${proposalAccount}`);
  console.log(
    `Transaction hash: https://explorer.solana.com/tx/${tx}?cluster=${agent.network}`
  );
  console.log(accountData);
}

//5ZitPreB9gJqZqhKrDTcBstUcA7rHth1VFiBcAYeFK7q

// Proposal created with publickey 7VkoPJ2dJE3Axz63zarRQSamqB1cMRcTYBvEco7bHp7R
// Transaction hash: https://explorer.solana.com/tx/4mUPMtj1YtmuwrrYvcHjsxhooxdJMyDSEWvy1n6UEtx2gPi2sCcnXPcNVZgUV6Nidj9g96L81jAVUsT7g5bHPi1T?cluster=devnet
// {
//   id: 'eb642768',
//   description: 'Help me',
//   targetAmount: <BN: b71b00>,
//   amountRaised: <BN: 0>,
//   executed: false,
//   owner: PublicKey [PublicKey(C131DzBFEzGhFL6bt2Gd4nRA7UDNL4a52C6af4ofvmui)] {
//     _bn: <BN: a372d26c17a47567967e9610a6892ffb3bab12ccde38b4173daf37417d92a449>
//   },
//   targetAccount: PublicKey [PublicKey(4tMN5HYmfpsAFgcxG2Ng14pfJwoy8f4Kz2V6n8tgPyim)] {
//     _bn: <BN: 39bab4fa7b1d5cc515b77518907e96797340dcb5742d06fb468791d71a308256>
//   },
//   token: PublicKey [PublicKey(5ZitPreB9gJqZqhKrDTcBstUcA7rHth1VFiBcAYeFK7q)] {
//     _bn: <BN: 43d0b1c1ec26ab6de2077cc175a07af5583e3c681140be41cfbf7b54e75fb1b4>
//   },
//   bump: 254
// }