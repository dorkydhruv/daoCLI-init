import {
  Connection,
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { SplGovernance } from "governance-idl-sdk";
import BN from "bn.js";
import { createMint, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { WalletService } from "../services/wallet-service";
import { ConnectionService } from "../services/connection-service";
import { SPL_GOVERNANCE_PROGRAM_ID } from "../utils/constants";

/**
 * Debug function to create a simple realm using the SplGovernance SDK
 */
async function createRealmDebug() {
  try {
    console.log("Creating realm for debugging...");

    // Load connection and wallet
    const connection = await ConnectionService.getConnection();
    const wallet = await WalletService.loadWallet();
    if (!wallet) {
      throw new Error("No wallet configured");
    }
    const keypair = WalletService.getKeypair(wallet);

    console.log(`Using wallet: ${keypair.publicKey.toBase58()}`);

    // Create SplGovernance instance
    const programId = new PublicKey(SPL_GOVERNANCE_PROGRAM_ID);
    const splGovernance = new SplGovernance(connection, programId);
    console.log(`Using governance program ID: ${programId.toBase58()}`);

    // Create community and council token mints
    console.log("Creating community token mint...");
    const communityToken = await createMint(
      connection,
      keypair,
      keypair.publicKey,
      null,
      6
    );
    console.log(`Created community token: ${communityToken.toBase58()}`);

    console.log("Creating council token mint...");
    const councilToken = await createMint(
      connection,
      keypair,
      keypair.publicKey,
      null,
      0
    );
    console.log(`Created council token: ${councilToken.toBase58()}`);

    // Define realm name
    const realmName = "DebugRealm";

    // Calculate PDAs for logging
    const realmId = splGovernance.pda.realmAccount({
      name: realmName,
    }).publicKey;
    console.log(`Expected realm address: ${realmId.toBase58()}`);

    // Create the realm instruction
    console.log("Creating realm instruction...");
    const createRealmIx = await splGovernance.createRealmInstruction(
      realmName,
      communityToken,
      new BN("18446744073709551615"), // DISABLED_VOTER_WEIGHT
      keypair.publicKey,
      undefined,
      councilToken,
      "dormant", // community token type
      "membership" // council token type
    );

    // Send transaction
    console.log("Sending transaction...");
    const recentBlockhash = await connection.getLatestBlockhash({
      commitment: "confirmed",
    });

    const txMessage = new TransactionMessage({
      payerKey: keypair.publicKey,
      instructions: [createRealmIx],
      recentBlockhash: recentBlockhash.blockhash,
    }).compileToV0Message();

    const tx = new VersionedTransaction(txMessage);
    tx.sign([keypair]);

    const sig = await connection.sendRawTransaction(tx.serialize());
    console.log(`Transaction sent with signature: ${sig}`);

    await connection.confirmTransaction(
      {
        signature: sig,
        blockhash: recentBlockhash.blockhash,
        lastValidBlockHeight: recentBlockhash.lastValidBlockHeight,
      },
      "confirmed"
    );
    console.log("Transaction confirmed!");

    // Verify realm was created
    const realmInfo = await connection.getAccountInfo(realmId);
    if (realmInfo) {
      console.log(`✅ Success! Realm created at ${realmId.toBase58()}`);
      return { realmAddress: realmId, signature: sig };
    } else {
      console.log(`❌ Failed - no account found at ${realmId.toBase58()}`);
      return { error: "Realm creation failed" };
    }
  } catch (error) {
    console.error("Error in createRealmDebug:", error);
    return { error };
  }
}

// Self-executing function to allow testing this file directly
(async () => {
  if (require.main === module) {
    console.log("Running realm creation debug script...");
    await createRealmDebug();
  }
})();

export { createRealmDebug };
