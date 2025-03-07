import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import BN from "bn.js";
import { SPL_GOVERNANCE_PROGRAM_ID } from "../utils/constants";
import { GovernanceConfig, SplGovernance } from "governance-idl-sdk";
import {
  createMint,
  AuthorityType,
  createSetAuthorityInstruction,
} from "@solana/spl-token";
import { MultisigService } from "./multisig-service";

// Constants
const DISABLED_VOTER_WEIGHT = new BN("18446744073709551615");
const DEFAULT_VOTING_TIME = 86400; // 1 day in seconds

export class GovernanceService {
  static programId = new PublicKey(SPL_GOVERNANCE_PROGRAM_ID);

  // Helper function to execute instructions - replaced with MultisigService.executeInstructions
  private static async executeInstructions(
    connection: Connection,
    payer: Keypair,
    instructions: TransactionInstruction[]
  ): Promise<string> {
    return MultisigService.executeInstructions(connection, payer, instructions);
  }

  static async initializeDAO(
    connection: Connection,
    keypair: Keypair,
    name: string,
    members: PublicKey[],
    threshold: number
  ): Promise<{
    realmAddress: PublicKey;
    governanceAddress: PublicKey;
    treasuryAddress: PublicKey;
    communityMint: PublicKey;
    councilMint: PublicKey;
  }> {
    console.log(`Initializing DAO with name: ${name}`);

    const splGovernance = new SplGovernance(connection, this.programId);

    // Create token mints
    const communityMint = await createMint(
      connection,
      keypair,
      keypair.publicKey,
      null,
      6
    );
    const councilMint = await createMint(
      connection,
      keypair,
      keypair.publicKey,
      null,
      0
    );

    // Calculate PDAs
    const realmId = splGovernance.pda.realmAccount({ name }).publicKey;
    const governanceId = splGovernance.pda.governanceAccount({
      realmAccount: realmId,
      seed: realmId,
    }).publicKey;
    const nativeTreasuryId = splGovernance.pda.nativeTreasuryAccount({
      governanceAccount: governanceId,
    }).publicKey;

    console.log(`Expected realm: ${realmId.toBase58()}`);
    console.log(`Expected governance: ${governanceId.toBase58()}`);
    console.log(`Expected treasury: ${nativeTreasuryId.toBase58()}`);

    // 1. Create realm
    console.log("1. Creating realm...");
    const createRealmIx = await splGovernance.createRealmInstruction(
      name,
      communityMint,
      DISABLED_VOTER_WEIGHT,
      keypair.publicKey,
      undefined,
      councilMint,
      "dormant",
      "membership"
    );

    const realmTx = new Transaction().add(createRealmIx);
    realmTx.feePayer = keypair.publicKey;
    const realmBlockhash = await connection.getLatestBlockhash();
    realmTx.recentBlockhash = realmBlockhash.blockhash;

    const realmSig = await sendAndConfirmTransaction(connection, realmTx, [
      keypair,
    ]);
    console.log(`Realm created: ${realmSig}`);

    // 2. Process member token records
    console.log("2. Adding members...");
    for (const member of members) {
      console.log(`Adding member: ${member.toBase58()}`);

      // Create token owner record for the member
      const createTokenOwnerRecordIx =
        await splGovernance.createTokenOwnerRecordInstruction(
          realmId,
          member,
          councilMint,
          keypair.publicKey
        );

      // Deposit governance tokens for the member
      const depositGovTokenIx =
        await splGovernance.depositGoverningTokensInstruction(
          realmId,
          councilMint,
          councilMint, // Source - using mint directly since we're the authority
          member,
          keypair.publicKey,
          keypair.publicKey,
          1
        );

      // Member signatures not required for non-payer members
      if (!member.equals(keypair.publicKey)) {
        depositGovTokenIx.keys.forEach((key) => {
          if (key.pubkey.equals(member) && key.isSigner) {
            key.isSigner = false;
          }
        });
      }

      const memberTx = new Transaction().add(
        createTokenOwnerRecordIx,
        depositGovTokenIx
      );
      memberTx.feePayer = keypair.publicKey;
      const memberBlockhash = await connection.getLatestBlockhash();
      memberTx.recentBlockhash = memberBlockhash.blockhash;

      const memberSig = await sendAndConfirmTransaction(connection, memberTx, [
        keypair,
      ]);
      console.log(`Member added: ${memberSig}`);
    }

    // 3. Calculate threshold percentage
    const thresholdPercentage = Math.floor((threshold / members.length) * 100);

    // 4. Create governance with directly matching multisig format
    const governanceConfig: GovernanceConfig = {
      communityVoteThreshold: { disabled: {} },
      minCommunityWeightToCreateProposal: DISABLED_VOTER_WEIGHT,
      minTransactionHoldUpTime: 0,
      votingBaseTime: DEFAULT_VOTING_TIME,
      communityVoteTipping: { disabled: {} },
      councilVoteThreshold: {
        yesVotePercentage: [thresholdPercentage],
      },
      councilVetoVoteThreshold: { disabled: {} },
      minCouncilWeightToCreateProposal: 1,
      councilVoteTipping: { early: {} },
      communityVetoVoteThreshold: { disabled: {} },
      votingCoolOffTime: 0,
      depositExemptProposalCount: 254,
    };

    const createGovernanceIx = await splGovernance.createGovernanceInstruction(
      governanceConfig,
      realmId,
      keypair.publicKey,
      undefined,
      keypair.publicKey,
      realmId
    );

    const governanceTx = new Transaction().add(createGovernanceIx);
    governanceTx.feePayer = keypair.publicKey;
    const governanceBlockhash = await connection.getLatestBlockhash();
    governanceTx.recentBlockhash = governanceBlockhash.blockhash;

    const governanceSig = await sendAndConfirmTransaction(
      connection,
      governanceTx,
      [keypair]
    );
    console.log(`Governance created: ${governanceSig}`);

    // 5. Create treasury and finalize setup
    const createNativeTreasuryIx =
      await splGovernance.createNativeTreasuryInstruction(
        governanceId,
        keypair.publicKey
      );

    const transferCommunityAuthIx = createSetAuthorityInstruction(
      communityMint,
      keypair.publicKey,
      AuthorityType.MintTokens,
      nativeTreasuryId
    );

    const transferCouncilAuthIx = createSetAuthorityInstruction(
      councilMint,
      keypair.publicKey,
      AuthorityType.MintTokens,
      nativeTreasuryId
    );

    const transferMultisigAuthIx =
      await splGovernance.setRealmAuthorityInstruction(
        realmId,
        keypair.publicKey,
        "setChecked",
        governanceId
      );

    const finalTx = new Transaction().add(
      createNativeTreasuryIx,
      transferCommunityAuthIx,
      transferCouncilAuthIx,
      transferMultisigAuthIx
    );
    finalTx.feePayer = keypair.publicKey;
    const finalBlockhash = await connection.getLatestBlockhash();
    finalTx.recentBlockhash = finalBlockhash.blockhash;

    const finalSig = await sendAndConfirmTransaction(connection, finalTx, [
      keypair,
    ]);
    console.log(`DAO setup finalized: ${finalSig}`);

    console.log("DAO initialization complete!");

    // Get the expected multisig address (even if not created yet)
    const expectedMultisigAddress =
      MultisigService.getMultisigForRealm(realmId);
    console.log(
      `Expected associated multisig: ${expectedMultisigAddress.toBase58()}`
    );

    return {
      realmAddress: realmId,
      governanceAddress: governanceId,
      treasuryAddress: nativeTreasuryId,
      communityMint,
      councilMint,
    };
  }
}
