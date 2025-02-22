import * as anchor from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccount,
  createMint,
  getAssociatedTokenAddressSync,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Program } from "@coral-xyz/anchor";
import { MultisigDao } from "../target/types/multisig_dao";
import { assert } from "chai";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { BN } from "bn.js";

describe("multisig-dao", () => {
  const provider = anchor.AnchorProvider.env();
  const wallet = provider.wallet as NodeWallet;
  const program = anchor.workspace.MultisigDao as Program<MultisigDao>;
  const daoName = "dao";
  const [config] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("tatami-config")],
    program.programId
  );
  const [vault] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("tatami-vault")],
    program.programId
  );

  const realmProgram = new anchor.web3.PublicKey(
    "GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw"
  );
  let mint: anchor.web3.PublicKey;
  const mintKeypair = anchor.web3.Keypair.generate();

  const [project] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("tatami-project"), mintKeypair.publicKey.toBuffer()],
    program.programId
  );

  const [realmAccount] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("governance"), Buffer.from(daoName)],
    realmProgram
  );

  const [communityTokenHolding] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("governance"),
      realmAccount.toBytes(),
      mintKeypair.publicKey.toBytes(),
    ],
    realmProgram
  );

  // const [councilTokenHolding] = anchor.web3.PublicKey.findProgramAddressSync(
  //   [
  //     Buffer.from("governance"),
  //     realmAccount.toBytes(),
  //     councilMint.publicKey.toBytes(),
  //   ],
  //   realmProgram
  // );

  const [realmConfig] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("realm-config"), realmAccount.toBytes()],
    realmProgram
  );

  const governedAccount = anchor.web3.Keypair.generate().publicKey;

  const [governance] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("account-governance"),
      realmAccount.toBytes(),
      governedAccount.toBytes(),
    ],
    realmProgram
  );

  const [nativeTreasury] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("native-treasury"), governance.toBytes()],
    realmProgram
  );

  const vaultTokenAccount = getAssociatedTokenAddressSync(
    mintKeypair.publicKey,
    vault,
    true
  );
  let daoTokenAccount: anchor.web3.PublicKey;
  anchor.setProvider(provider);

  before(async () => {
    // Initialize the mint only
    mint = await createMint(
      provider.connection,
      wallet.payer,
      wallet.publicKey,
      null,
      6,
      mintKeypair,
      undefined,
      TOKEN_PROGRAM_ID
    );

    // Just compute the dao token account address
    daoTokenAccount = getAssociatedTokenAddressSync(
      mint,
      nativeTreasury,
      true,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
  });

  it("Is initialized!", async () => {
    const tx = await program.methods.initialize().rpc();
  });

  describe("create-dao", () => {
    it("fails with empty name", async () => {
      try {
        await program.methods
          .createDao("", new BN(100), new BN(1), false, 5, 30 * 60 * 60)
          .accountsPartial({
            mint: mintKeypair.publicKey,
            councilMint: null,
            communityTokenHolding,
            realmAccount,
            realmConfig,
            realmProgram,
            councilTokenHolding: null,
            governance,
            governedAccount,
            nativeTreasury,
            daoTokenAccount,
            signer: wallet.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .rpc();
        assert.fail("should have failed with empty name");
      } catch (err) {
        assert.include(err.message, "DAO name cannot be empty");
      }
    });

    it("fails with too long name", async () => {
      const longName = "a".repeat(33);
      try {
        await program.methods
          .createDao(longName, new BN(100), new BN(1), false, 5, 30 * 60 * 60)
          .accountsPartial({
            mint: mintKeypair.publicKey,
            councilMint: null,
            communityTokenHolding,
            realmAccount,
            realmConfig,
            realmProgram,
            councilTokenHolding: null,
            governance,
            governedAccount,
            nativeTreasury,
            daoTokenAccount,
            signer: wallet.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .rpc();
        assert.fail("should have failed with long name");
      } catch (err) {
        assert.include(err.message, "DAO name too long");
      }
    });

    it("fails with zero supply", async () => {
      try {
        await program.methods
          .createDao(daoName, new BN(0), new BN(1), false, 5, 30 * 60 * 60)
          .accountsPartial({
            mint: mintKeypair.publicKey,
            councilMint: null,
            communityTokenHolding,
            realmAccount,
            realmConfig,
            realmProgram,
            councilTokenHolding: null,
            governance,
            governedAccount,
            nativeTreasury,
            daoTokenAccount,
            signer: wallet.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .rpc();
        assert.fail("should have failed with zero supply");
      } catch (err) {
        assert.include(err.message, "Supply must be greater than zero");
      }
    });

    it("fails with invalid quorum", async () => {
      try {
        await program.methods
          .createDao(daoName, new BN(100), new BN(1), false, 101, 30 * 60 * 60)
          .accountsPartial({
            mint: mintKeypair.publicKey,
            councilMint: null,
            communityTokenHolding,
            realmAccount,
            realmConfig,
            realmProgram,
            councilTokenHolding: null,
            governance,
            governedAccount,
            nativeTreasury,
            daoTokenAccount,
            signer: wallet.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .rpc();
        assert.fail("should have failed with invalid quorum");
      } catch (err) {
        assert.include(
          err.message,
          "quorum should be in the range of 1 and 100"
        );
      }
    });

    it("fails with zero vote duration", async () => {
      try {
        await program.methods
          .createDao(daoName, new BN(100), new BN(1), false, 5, 0)
          .accountsPartial({
            mint: mintKeypair.publicKey,
            councilMint: null,
            communityTokenHolding,
            realmAccount,
            realmConfig,
            realmProgram,
            councilTokenHolding: null,
            governance,
            governedAccount,
            nativeTreasury,
            daoTokenAccount,
            signer: wallet.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .rpc();
        assert.fail("should have failed with zero vote duration");
      } catch (err) {
        assert.include(err.message, "Vote duration must be greater than zero");
      }
    });

    it("successfully creates a DAO", async () => {
      const supply = new BN(100);
      const minVoteToGovern = new BN(1);
      const quorum = 5;
      const voteDuration = 30 * 60 * 60; // 30 hours

      const tx = await program.methods
        .createDao(
          daoName,
          supply,
          minVoteToGovern,
          false,
          quorum,
          voteDuration
        )
        .accountsPartial({
          mint: mintKeypair.publicKey,
          councilMint: null,
          communityTokenHolding,
          realmAccount,
          realmConfig,
          realmProgram,
          councilTokenHolding: null,
          governance,
          governedAccount,
          nativeTreasury,
          daoTokenAccount,
          signer: wallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      // Verify DAO creation
      const realmAccountInfo = await provider.connection.getAccountInfo(
        realmAccount
      );
      assert.isNotNull(realmAccountInfo, "Realm account should exist");

      const governanceAccountInfo = await provider.connection.getAccountInfo(
        governance
      );
      assert.isNotNull(
        governanceAccountInfo,
        "Governance account should exist"
      );

      const treasuryAccountInfo = await provider.connection.getAccountInfo(
        nativeTreasury
      );
      assert.isNotNull(treasuryAccountInfo, "Treasury account should exist");

      const daoTokenAccountInfo = await provider.connection.getAccountInfo(
        daoTokenAccount
      );
      assert.isNotNull(daoTokenAccountInfo, "DAO token account should exist");
    });
  });
});
