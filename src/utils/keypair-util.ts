import { Keypair, PublicKey } from "@solana/web3.js";
import * as crypto from "crypto";
import * as multisig from "@sqds/multisig";
/**
 * Utility for working with deterministic keypairs
 */
export class KeypairUtil {
  /**
   * Derives a deterministic keypair from a realm address
   * This allows anyone with the realm address to derive the same keypair
   * which can be used as a createKey for associated multisig
   */
  static getRealmDerivedKeypair(realmAddress: PublicKey): Keypair {
    // Create a deterministic seed from the realm address
    const seed = crypto
      .createHash("sha256")
      .update(
        Buffer.concat([realmAddress.toBuffer(), Buffer.from("multisig-seed")])
      )
      .digest();

    // Use the seed to create a keypair
    return Keypair.fromSeed(seed.slice(0, 32));
  }

  /**
   * Given a realm address, derives the expected multisig address
   * This is a convenience method that combines getRealmDerivedKeypair with multisig PDA derivation
   */
  static getRealmAssociatedMultisigAddress(realmAddress: PublicKey): PublicKey {
    const derivedKeypair = this.getRealmDerivedKeypair(realmAddress);
    const [multisigPda] = multisig.getMultisigPda({
      createKey: derivedKeypair.publicKey,
    });
    return multisigPda;
  }
}
