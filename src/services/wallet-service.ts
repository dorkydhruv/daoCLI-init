import {
  Keypair,
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
} from "@solana/web3.js";
import pkg from "bs58";
const { decode } = pkg;
import fs from "fs-extra";
import { WALLET_PATH, CONFIG_DIR } from "../utils/constants";
import { WalletConfig } from "../types";

export class WalletService {
  static async createWallet(): Promise<WalletConfig> {
    const keypair = Keypair.generate();
    const walletConfig: WalletConfig = {
      keypair: Array.from(keypair.secretKey),
      pubkey: keypair.publicKey.toBase58(),
    };

    // Ensure config directory exists
    await fs.ensureDir(CONFIG_DIR);

    // Save wallet to file
    await fs.writeJSON(WALLET_PATH, walletConfig, { spaces: 2 });

    return walletConfig;
  }

  static async loadWallet(): Promise<WalletConfig | null> {
    if (!fs.existsSync(WALLET_PATH)) {
      return null;
    }
    return fs.readJSON(WALLET_PATH) as Promise<WalletConfig>;
  }

  static getKeypair(walletConfig: WalletConfig): Keypair {
    return Keypair.fromSecretKey(Uint8Array.from(walletConfig.keypair));
  }

  static async importWallet(secretKeyString: string): Promise<WalletConfig> {
    let secretKey: number[];

    // Handle different formats of secret key
    if (secretKeyString.includes("[") && secretKeyString.includes("]")) {
      // It's an array string
      secretKey = JSON.parse(secretKeyString);
    } else {
      // It's a base58 string or path to a keypair file
      try {
        if (fs.existsSync(secretKeyString)) {
          // It's a file path
          const keyfileContent = await fs.readFile(secretKeyString, "utf-8");
          secretKey = JSON.parse(keyfileContent);
        } else {
          // It's likely a base58 string
          // will get to this in a while
          // secretKey = decode(secretKeyS)
          throw new Error("Invalid secret key format");
        }
      } catch (error) {
        throw new Error(`Failed to import wallet: ${error}`);
      }
    }

    const keypair = Keypair.fromSecretKey(Uint8Array.from(secretKey));
    const walletConfig: WalletConfig = {
      keypair: secretKey,
      pubkey: keypair.publicKey.toBase58(),
    };

    // Ensure config directory exists
    await fs.ensureDir(CONFIG_DIR);

    // Save wallet to file
    await fs.writeJSON(WALLET_PATH, walletConfig, { spaces: 2 });

    return walletConfig;
  }

  static async getBalance(
    connection: Connection,
    pubkey: string
  ): Promise<number> {
    const balance = await connection.getBalance(new PublicKey(pubkey));
    return balance / LAMPORTS_PER_SOL;
  }
}
