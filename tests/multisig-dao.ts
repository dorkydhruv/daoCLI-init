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
import { BN, min } from "bn.js";

describe("multisig-dao", () => {
  const provider = anchor.AnchorProvider.env();
  const wallet = provider.wallet as NodeWallet;
  const program = anchor.workspace.MultisigDao as Program<MultisigDao>;

  // Change to a simple lowercase name to avoid encoding issues
  const daoName = "mydao";
  const realmProgram = new anchor.web3.PublicKey(
    "GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw"
  );
  let councilMint: anchor.web3.PublicKey;
  let communityMint: anchor.web3.PublicKey;
  const councilMintKeypair = anchor.web3.Keypair.generate();
  const communityMintKeypair = anchor.web3.Keypair.generate();

  // Define PDA variables that will be set after mint creation
  let realmAccount: anchor.web3.PublicKey;
  let communityTokenHolding: anchor.web3.PublicKey;
  let councilTokenHolding: anchor.web3.PublicKey;
  let realmConfig: anchor.web3.PublicKey;
  let governance: anchor.web3.PublicKey;

  const governedAccount = anchor.web3.Keypair.generate().publicKey;

  anchor.setProvider(provider);

  before(async () => {
    // Initialize the mints first
    councilMint = await createMint(
      provider.connection,
      wallet.payer,
      wallet.publicKey,
      null,
      6,
      councilMintKeypair,
      undefined,
      TOKEN_PROGRAM_ID
    );
    communityMint = await createMint(
      provider.connection,
      wallet.payer,
      wallet.publicKey,
      null,
      6,
      communityMintKeypair,
      undefined,
      TOKEN_PROGRAM_ID
    );

    console.log("Council mint:", councilMint.toString());
    console.log("Community mint:", communityMint.toString());

    // Now derive all PDAs using the actual mint addresses
    realmAccount = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("governance"), Buffer.from(daoName)],
      realmProgram
    )[0];

    console.log("Realm account PDA:", realmAccount.toString());

    communityTokenHolding = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("governance"),
        realmAccount.toBytes(),
        communityMint.toBytes(),
      ],
      realmProgram
    )[0];

    councilTokenHolding = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("governance"),
        realmAccount.toBytes(),
        councilMint.toBytes(),
      ],
      realmProgram
    )[0];

    realmConfig = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("realm-config"), realmAccount.toBytes()],
      realmProgram
    )[0];

    governance = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("account-governance"),
        realmAccount.toBytes(),
        governedAccount.toBytes(),
      ],
      realmProgram
    )[0];
  });

  it("Is initialized!", async () => {
    // Insert a delay to allow for blockhash refresh
    await new Promise((resolve) => setTimeout(resolve, 2000));
    try {
      const tx = await program.methods.initialize().rpc();
      await provider.connection.confirmTransaction(tx);
    } catch (error) {
      console.error("Transaction failed:", error);
      throw error;
    }
  });

  describe("create-dao", () => {
    it("successfully creates a DAO", async () => {
      try {
        // Print important account addresses for debugging
        console.log("Realm Account:", realmAccount.toBase58());
        console.log(
          "Community Token Holding:",
          communityTokenHolding.toBase58()
        );
        console.log("Council Token Holding:", councilTokenHolding.toBase58());
        console.log("Community Mint:", communityMint.toBase58());
        console.log("Council Mint:", councilMint.toBase58());
        console.log("Realm Config:", realmConfig.toBase58());

        // Insert delay to prevent blockhash timeout
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const tx = await program.methods
          .createDao(daoName)
          .accountsPartial({
            realmAccount,
            councilMint,
            communityMint,
            communityTokenHolding,
            councilTokenHolding,
            realmConfig,
            realmProgram,
            governance,
            governedAccount,
            signer: wallet.publicKey,
            payer: wallet.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .rpc({ commitment: "confirmed", skipPreflight: true }); // Try skip preflight to get error details

        await provider.connection.confirmTransaction(tx, "confirmed");
        console.log("DAO created successfully");
      } catch (error) {
        console.error("Failed to create DAO:", error);
        if (error.logs) {
          console.error("Error logs:");
          console.error(error.logs.join("\n"));
        }
        throw error;
      }
    });
  });
});
