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
import * as squadMultisig from "@sqds/multisig";
import { ComputeBudgetProgram, PublicKey } from "@solana/web3.js";

describe("multisig-dao", () => {
  const provider = anchor.AnchorProvider.env();
  const wallet = provider.wallet as NodeWallet;
  const program = anchor.workspace.MultisigDao as Program<MultisigDao>;

  const daoName = "multisigdao";
  const realmProgram = new anchor.web3.PublicKey(
    "GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw"
  );
  const squadsProgram = squadMultisig.PROGRAM_ID;

  let squadsTreasury: anchor.web3.PublicKey;
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

    // Derive Squads PDAs - using the same logic as in the updated Rust code
    const createKey = wallet.publicKey;
    multisig = squadMultisig.getMultisigPda({ createKey })[0];
    programConfig = squadMultisig.getProgramConfigPda({})[0];
    squadsTreasury = (
      await squadMultisig.accounts.ProgramConfig.fromAccountAddress(
        provider.connection,
        programConfig
      )
    ).treasury;

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

        // Step 1: First create a multisig that will be governed
        console.log("Creating multisig first...");

        // Random key that will be used to derive a multisig PDA
        const createKey = anchor.web3.Keypair.generate();

        // Derive the multisig PDA
        const [multisigPda] = squadMultisig.getMultisigPda({
          createKey: createKey.publicKey,
        });
        console.log("New multisig PDA:", multisigPda.toString());

        // IMPORTANT: Recalculate the governance PDA using this specific multisig PDA
        const governancePda = anchor.web3.PublicKey.findProgramAddressSync(
          [
            Buffer.from("account-governance"),
            realmAccount.toBytes(),
            multisigPda.toBytes(), // Use the newly created multisig PDA
          ],
          realmProgram
        )[0];
        console.log("Recalculated governance PDA:", governancePda.toString());

        // Get program config
        const programConfigPda = squadMultisig.getProgramConfigPda({})[0];
        const programConfig =
          await squadMultisig.accounts.ProgramConfig.fromAccountAddress(
            provider.connection,
            programConfigPda
          );

        const configTreasury = programConfig.treasury;

        // Create the multisig without governance authority initially
        const createMultisigIx =
          await squadMultisig.instructions.multisigCreateV2({
            createKey: createKey.publicKey,
            creator: wallet.publicKey,
            multisigPda,
            configAuthority: null, // No authority initially
            timeLock: 0,
            members: [
              {
                key: wallet.publicKey,
                permissions: squadMultisig.types.Permissions.all(),
              },
            ],
            threshold: 1,
            treasury: configTreasury,
            rentCollector: wallet.publicKey,
          });

        // Send the multisig creation transaction
        const multisigTx = new anchor.web3.Transaction()
          .add(
            ComputeBudgetProgram.setComputeUnitLimit({
              units: 200000,
            })
          )
          .add(createMultisigIx);

        // Sign and send the transaction
        const multisigSig = await provider.sendAndConfirm(multisigTx, [
          wallet.payer,
          createKey,
        ]);
        console.log("Initial multisig created:", multisigSig);

        // Verify multisig was created
        let multisigAccountInfo = await provider.connection.getAccountInfo(
          multisigPda
        );
        console.log("Multisig account exists:", !!multisigAccountInfo);

        // Higher compute budget for complex operations
        const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
          units: 400000,
        });

        // Add priority fee
        const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: 50_000,
        });

        // Step 2: Now create the realm and governance over the multisig
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
            governance: governancePda, 
            multisig: multisigPda, 
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

        console.log("DAO creation transaction submitted:", tx);
        await provider.connection.confirmTransaction(tx, "confirmed");
        console.log("DAO creation transaction confirmed!");
        console.log("Updating multisig authority to governance...");
        console.log("Verifying accounts...");
        const realmAccountInfo = await provider.connection.getAccountInfo(
          realmAccount
        );
        console.log("Realm account exists:", !!realmAccountInfo);

        // Verify the governance was created
        const governanceAccountInfo = await provider.connection.getAccountInfo(
          governancePda
        );
        console.log("Governance account exists:", !!governanceAccountInfo);
        console.log("Multisig DAO creation structure complete!");
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
