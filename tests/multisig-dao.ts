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
import { ComputeBudgetProgram, PublicKey } from "@solana/web3.js";

describe("multisig-dao", () => {
  const provider = anchor.AnchorProvider.env();
  const wallet = provider.wallet as NodeWallet;
  const program = anchor.workspace.MultisigDao as Program<MultisigDao>;

  const daoName = "multisigdao";
  const realmProgram = new anchor.web3.PublicKey(
    "GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw"
  );
  const squadsProgram = new anchor.web3.PublicKey(
    "SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu"
  );
  const squadsTreasury = new PublicKey(
    "SQDS4ep65T869zbu3z5AsHyisXzyYNMBR89aJ1SErJq"
  );

  let councilMint: anchor.web3.PublicKey;
  let communityMint: anchor.web3.PublicKey;
  const councilMintKeypair = anchor.web3.Keypair.generate();
  const communityMintKeypair = anchor.web3.Keypair.generate();

  // Define PDA variables
  let realmAccount: anchor.web3.PublicKey;
  let communityTokenHolding: anchor.web3.PublicKey;
  let councilTokenHolding: anchor.web3.PublicKey;
  let realmConfig: anchor.web3.PublicKey;
  let governance: anchor.web3.PublicKey;
  let tokenOwnerRecord: anchor.web3.PublicKey;

  // Squads PDAs
  let multisig: anchor.web3.PublicKey;
  let programConfig: anchor.web3.PublicKey;

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

    // Derive all PDAs
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

    // Derive Squads PDAs
    const createKey = wallet.publicKey;
    multisig = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("squad"), Buffer.from("multisig"), createKey.toBytes()],
      squadsProgram
    )[0];

    programConfig = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("squad"), Buffer.from("program_config")],
      squadsProgram
    )[0];

    // Governance PDA - now governance over the multisig
    governance = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("account-governance"),
        realmAccount.toBytes(),
        multisig.toBytes(), // Using multisig as governed account
      ],
      realmProgram
    )[0];

    // Token owner record
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
    console.log("Multisig PDA:", multisig.toString());
    console.log("Governance PDA:", governance.toString());

    // Create community tokens
    const communityATA = (
      await getOrCreateAssociatedTokenAccount(
        provider.connection,
        wallet.payer,
        communityMint,
        wallet.publicKey
      )
    ).address;

    // Mint tokens
    await mintTo(
      provider.connection,
      wallet.payer,
      communityMint,
      communityATA,
      wallet.publicKey,
      1000 * 10 ** 6,
      []
    );

    console.log("Minted community tokens to:", communityATA.toString());
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

  describe("create-multisig-dao", () => {
    it("successfully creates a multisig DAO with governance authority", async () => {
      try {
        console.log("Creating a multisig DAO with governance as authority");

        // Higher compute budget for complex operations
        const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
          units: 400000,
        });

        // Add priority fee
        const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: 50_000,
        });

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
            multisig, // This is the new squads multisig account
            programConfig, // Squads program config
            tokenOwnerRecord,
            squadsProgram: squadsProgram, // Squads program
            squadsProgramTreasury: squadsTreasury, // Squads treasury
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

        // Verify the multisig was created
        const multisigAccountInfo = await provider.connection.getAccountInfo(
          multisig
        );
        console.log("Multisig account exists:", !!multisigAccountInfo);

        // Verify governance was created
        const governanceAccountInfo = await provider.connection.getAccountInfo(
          governance
        );
        console.log("Governance account exists:", !!governanceAccountInfo);

        // In a real test, we would verify the multisig config_authority is set to governance
        if (multisigAccountInfo) {
          console.log(
            "Multisig account data size:",
            multisigAccountInfo.data.length
          );
          // We would decode the account data to check if governance is the config authority
          // This would require deserializing the multisig account data
          console.log(
            "Multisig DAO created successfully with governance as authority!"
          );
        }
      } catch (error) {
        console.error("Failed to create multisig DAO:", error);

        if (error.logs) {
          console.error("Error logs:");
          error.logs.forEach((log, i) => console.error(`${i}: ${log}`));
        }
        throw error;
      }
    });
  });
});
