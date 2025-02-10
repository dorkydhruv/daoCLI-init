import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  createAccount,
  createMint,
  mintTo,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccount,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import { DaoContract } from "../target/types/dao_contract";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { assert } from "chai";
import { ASSOCIATED_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/utils/token";

describe("dao-contract", async () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.DaoContract as Program<DaoContract>;
  const wallet = provider.wallet as NodeWallet;
  const connection = provider.connection;
  const mintKeypair = anchor.web3.Keypair.generate();
  let token: anchor.web3.PublicKey;
  let tokenAccount: anchor.web3.PublicKey;
  it("creates an SPL token", async () => {
    const amount = 20 * Math.pow(10, 6); // this is the amount of tokens to mint
    token = await createMint(
      connection,
      wallet.payer,
      wallet.publicKey,
      null,
      6,
      mintKeypair,
      undefined,
      TOKEN_PROGRAM_ID
    );
    tokenAccount = await createAssociatedTokenAccount(
      connection,
      wallet.payer,
      token,
      wallet.publicKey
    );

    await mintTo(
      connection,
      wallet.payer,
      token,
      tokenAccount,
      wallet.publicKey,
      amount
    );

    const balance = await connection.getTokenAccountBalance(tokenAccount);
    assert.equal(
      balance.value.amount.toString(),
      amount.toString(),
      "Balance should be equal to amount minted"
    );
  });

  const school = anchor.web3.Keypair.generate();

  const proposalData = {
    proposalId: new anchor.BN(1),
    description: "Let's build a new school",
    targetAmount: new anchor.BN(2 * Math.pow(10, 6)),
    targetAccount: school.publicKey,
  };
  const [proposalAccount, proposalAccountBump] =
    anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("proposal"),
        // Updated to use an 8-byte little-endian representation
        Buffer.from(proposalData.proposalId.toArray("le", 8)),
        wallet.publicKey.toBuffer(),
      ],
      program.programId
    );
  it("creates a DAO proposal", async () => {
    const tx = await program.methods
      .createProposal(
        proposalData.proposalId,
        proposalData.description,
        proposalData.targetAmount,
        proposalData.targetAccount
      )
      .accountsPartial({
        payer: wallet.publicKey,
        proposal: proposalAccount,
        token: token,
        associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
    const accountData = await program.account.proposal.fetch(proposalAccount);
    assert.equal(
      accountData.description,
      proposalData.description,
      "Description should match"
    );
    assert.equal(
      accountData.targetAmount.toString(),
      proposalData.targetAmount.toString(),
      "Target amount should match"
    );
    assert.equal(
      accountData.targetAccount.toString(),
      proposalData.targetAccount.toString(),
      "Target account should match"
    );
    assert.equal(accountData.bump, proposalAccountBump, "Bump should match");
  });

  it("contributes to a DAO proposal", async () => {
    const proposalTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      wallet.payer,
      token,
      proposalAccount,
      true
    );
    const amount = new anchor.BN(5 * Math.pow(10, 6));
    try {
      const tx = await program.methods
        .contribute(amount)
        .accountsPartial({
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          token,
          contributor: wallet.publicKey,
          contributorTokenAccount: tokenAccount,
          proposal: proposalAccount,
          proposalTokenAccount: proposalTokenAccount.address,
        })
        .rpc();

      const proposalBalance = await connection.getTokenAccountBalance(
        proposalTokenAccount.address
      );
      const contributorBalance = await connection.getTokenAccountBalance(
        tokenAccount
      );

      assert.equal(
        proposalBalance.value.amount.toString(),
        amount.toString(),
        "Proposal balance should match amount contributed"
      );
      assert.equal(
        contributorBalance.value.amount.toString(),
        (15 * Math.pow(10, 6)).toString(),
        "Contributor balance should match amount contributed"
      );
    } catch (error) {
      console.error("Error:", error);
      throw error;
    }
  });

  it("executes a DAO proposal once target amount is reached", async () => {
    const proposalTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      wallet.payer,
      token,
      proposalAccount,
      true
    );
    const initialBalance = await connection.getTokenAccountBalance(
      proposalTokenAccount.address
    );

    const schoolTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      wallet.payer,
      token,
      school.publicKey
    );

    try {
      const tx = await program.methods
        .executeProposal()
        .accountsPartial({
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          token,
          proposal: proposalAccount,
          proposalTokenAccount: proposalTokenAccount.address,
          targetAccount: school.publicKey,
          associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
          signer: wallet.publicKey,
          targetTokenAccount: schoolTokenAccount.address,
        })
        .rpc();
      const finalProposalBalance = await connection.getTokenAccountBalance(
        proposalTokenAccount.address
      );
      const schoolBalance = await connection.getTokenAccountBalance(
        schoolTokenAccount.address
      );

      assert.equal(
        schoolBalance.value.amount.toString(),
        initialBalance.value.amount.toString(),
        "School balance should match initial proposal balance"
      );
      assert.equal(
        finalProposalBalance.value.amount.toString(),
        "0",
        "Proposal balance should be zero"
      );
    } catch (error) {
      console.error("Execute error:", error);
      throw error;
    }
  });
});
