import {
  Connection,
  Keypair,
  PublicKey,
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

// Constants
const DISABLED_VOTER_WEIGHT = new BN("18446744073709551615");
const DEFAULT_VOTING_TIME = 86400; // 1 day in seconds

export class GovernanceService {
  static programId = new PublicKey(SPL_GOVERNANCE_PROGRAM_ID);

  // Helper function to execute instructions
  private static async executeInstructions(
    connection: Connection,
    payer: Keypair,
    instructions: TransactionInstruction[]
  ): Promise<string> {
    const recentBlockhash = await connection.getLatestBlockhash({
      commitment: "confirmed",
    });

    const txMessage = new TransactionMessage({
      payerKey: payer.publicKey,
      instructions,
      recentBlockhash: recentBlockhash.blockhash,
    }).compileToV0Message();

    const tx = new VersionedTransaction(txMessage);
    tx.sign([payer]);

    try {
      const signature = await connection.sendRawTransaction(tx.serialize(), {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      });

      await connection.confirmTransaction(
        {
          signature,
          blockhash: recentBlockhash.blockhash,
          lastValidBlockHeight: recentBlockhash.lastValidBlockHeight,
        },
        "confirmed"
      );

      return signature;
    } catch (err: any) {
      if (err?.getLogs) {
        try {
          console.error("Transaction logs:", await err.getLogs());
        } catch {}
      }
      throw err;
    }
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

    // Instruction batches
    const setupInstructions: TransactionInstruction[] = [];
    const memberInstructions: TransactionInstruction[][] = [];
    const finalInstructions: TransactionInstruction[] = [];

    // 1. Create realm
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
    setupInstructions.push(createRealmIx);

    // 2. Process member token records
    for (const member of members) {
      const memberIxs: TransactionInstruction[] = [];

      const createTokenOwnerRecordIx =
        await splGovernance.createTokenOwnerRecordInstruction(
          realmId,
          member,
          councilMint,
          keypair.publicKey
        );

      const depositGovTokenIx =
        await splGovernance.depositGoverningTokensInstruction(
          realmId,
          councilMint,
          councilMint,
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

      memberIxs.push(createTokenOwnerRecordIx, depositGovTokenIx);
      memberInstructions.push(memberIxs);
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
    finalInstructions.push(createGovernanceIx);

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

    finalInstructions.push(
      createNativeTreasuryIx,
      transferCommunityAuthIx,
      transferCouncilAuthIx,
      transferMultisigAuthIx
    );

    // Execute all instruction batches in sequence
    console.log("1. Creating realm...");
    await this.executeInstructions(connection, keypair, setupInstructions);

    console.log("2. Adding members...");
    for (let i = 0; i < memberInstructions.length; i++) {
      console.log(`   Member ${i + 1}/${memberInstructions.length}`);
      await this.executeInstructions(
        connection,
        keypair,
        memberInstructions[i]
      );
    }

    console.log("3. Finalizing DAO setup...");
    await this.executeInstructions(connection, keypair, finalInstructions);

    console.log("DAO initialization complete!");

    return {
      realmAddress: realmId,
      governanceAddress: governanceId,
      treasuryAddress: nativeTreasuryId,
      communityMint,
      councilMint,
    };
  }
}
