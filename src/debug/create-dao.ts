import { PublicKey, Keypair } from "@solana/web3.js";
import { WalletService } from "../services/wallet-service";
import { ConnectionService } from "../services/connection-service";
import { GovernanceService } from "../services/governance-service";

/**
 * Debug function to test the full DAO initialization flow
 */
async function createDaoDebug() {
  try {
    console.log("Creating DAO for debugging...");

    // Load connection and wallet
    const connection = await ConnectionService.getConnection();
    const wallet = await WalletService.loadWallet();
    if (!wallet) {
      throw new Error("No wallet configured");
    }
    const keypair = WalletService.getKeypair(wallet);

    console.log(`Using wallet: ${keypair.publicKey.toBase58()}`);

    // Add a test member
    const testMember = Keypair.generate().publicKey;
    console.log(`Created test member: ${testMember.toBase58()}`);

    const members = [keypair.publicKey, testMember];
    const result = await GovernanceService.initializeDAO(
      connection,
      keypair,
      "DebugDAO",
      members,
      1 // 1 of 2 threshold
    );

    console.log("\n✅ DAO created successfully!");
    console.log(`Realm: ${result.realmAddress.toBase58()}`);
    console.log(`Governance: ${result.governanceAddress.toBase58()}`);
    console.log(`Treasury: ${result.treasuryAddress.toBase58()}`);

    return result;
  } catch (error) {
    console.error("Error in createDaoDebug:", error);
    return { error };
  }
}

// Run when file is executed directly
if (require.main === module) {
  createDaoDebug();
}

export { createDaoDebug };
