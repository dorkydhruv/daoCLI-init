import * as anchor from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Program } from "@coral-xyz/anchor";
import { MultisigDao } from "../target/types/multisig_dao";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { BN } from "bn.js";
import { ComputeBudgetProgram } from "@solana/web3.js";

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
  let tokenOwnerRecord: anchor.web3.PublicKey;

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

    // Setup token owner record
    tokenOwnerRecord = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("governance"),
        realmAccount.toBytes(),
        communityMint.toBytes(),
        wallet.publicKey.toBytes(),
      ],
      realmProgram
    )[0];

    console.log("Token Owner Record:", tokenOwnerRecord.toString());

    // Create council tokens first
    const communityATA = (
      await getOrCreateAssociatedTokenAccount(
        provider.connection,
        wallet.payer,
        communityMint,
        wallet.publicKey
      )
    ).address;

    // Mint council tokens - these are the only tokens with voting power
    await mintTo(
      provider.connection,
      wallet.payer,
      communityMint,
      communityATA,
      wallet.publicKey,
      1000 * 10 ** 6,
      []
    );

    console.log("Minted council tokens to:", communityATA.toString());

    // Verify token balance
    try {
      const tokenBalance = await provider.connection.getTokenAccountBalance(
        communityATA
      );
      console.log("Council token balance:", tokenBalance.value.uiAmount);
    } catch (e) {
      console.error("Failed to get token balance:", e);
    }

    // Check if program is deployed at the beginning
    try {
      const programInfo = await provider.connection.getAccountInfo(
        realmProgram
      );
      console.log("Program exists:", !!programInfo);
      if (programInfo) {
        console.log("Program size:", programInfo.data.length);
      } else {
        console.warn(
          "PROGRAM NOT DEPLOYED! Deploy using 'anchor deploy' before testing."
        );
      }
    } catch (e) {
      console.error("Failed to check program deployment:", e);
    }
  });

  it("Is initialized!", async () => {
    try {
      const tx = await program.methods.initialize().rpc();
      await provider.connection.confirmTransaction(tx);
    } catch (error) {
      console.error("Transaction failed:", error);
      throw error;
    }
  });

  describe("create-dao", () => {
    it("successfully creates a realm and token owner record", async () => {
      try {
        console.log("Creating a DAO realm with token owner record");
        console.log("Council mint:", councilMint.toBase58());
        console.log("Community mint:", communityMint.toBase58());

        // Higher compute budget for complex operations
        const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
          units: 400000,
        });

        // Add priority fee
        const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: 50_000,
        });

        // Calculate expected token owner record for verification
        const expectedTokenOwnerRecord =
          anchor.web3.PublicKey.findProgramAddressSync(
            [
              Buffer.from("governance"),
              realmAccount.toBytes(),
              communityMint.toBytes(), // Use communityMint instead of councilMint
              wallet.publicKey.toBytes(),
            ],
            realmProgram
          )[0];

        console.log(
          "Expected token owner record address:",
          expectedTokenOwnerRecord.toString()
        );

        // Call our DAO creation instruction
        console.log("Sending createDao transaction...");
        const tx = await program.methods
          .createDao(
            daoName,
            new BN(1), // min_vote_to_govern
            60, // quorum
            30 * 60 // vote_duration
          )
          .accountsPartial({
            signer: wallet.publicKey,
            payer: wallet.publicKey,
            communityMint,
            councilMint,
            realmAccount,
            communityTokenHolding,
            councilTokenHolding,
            realmConfig,
            governance,
            governedAccount,
            tokenOwnerRecord,
            realmProgram,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .preInstructions([modifyComputeUnits, addPriorityFee])
          .rpc({
            commitment: "confirmed",
          });

        console.log("Transaction submitted:", tx);

        await provider.connection.confirmTransaction(tx, "confirmed");
        console.log("Transaction confirmed!");

        // Verify the realm was created
        const realmAccountInfo = await provider.connection.getAccountInfo(
          realmAccount
        );
        console.log("Realm account exists:", !!realmAccountInfo);

        // Verify the token owner record was created
        const tokenOwnerRecordInfo = await provider.connection.getAccountInfo(
          expectedTokenOwnerRecord
        );
        console.log("Token owner record exists:", !!tokenOwnerRecordInfo);
        if (tokenOwnerRecordInfo) {
          console.log(
            "Token owner record size:",
            tokenOwnerRecordInfo.data.length
          );
        }
        const governanceInfo = await provider.connection.getAccountInfo(
          governance
        );
        console.log("Governance account exists:", !!governanceInfo);
      } catch (error) {
        console.error("Failed to create DAO:", error);

        if (error.logs) {
          console.error("Error logs:");
          error.logs.forEach((log, i) => console.error(`${i}: ${log}`));
        }
        throw error;
      }
    });
  });
});
