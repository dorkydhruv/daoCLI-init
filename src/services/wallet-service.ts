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
import { ServiceResponse, WalletData } from "../types/service-types";

export class WalletService {
  static async createWallet(): Promise<ServiceResponse<WalletConfig>> {
    try {
      const keypair = Keypair.generate();
      const walletConfig: WalletConfig = {
        keypair: Array.from(keypair.secretKey),
        pubkey: keypair.publicKey.toBase58(),
      };

      // Ensure config directory exists
      await fs.ensureDir(CONFIG_DIR);

      // Save wallet to file
      await fs.writeJSON(WALLET_PATH, walletConfig, { spaces: 2 });

      return { success: true, data: walletConfig };
    } catch (error) {
      return {
        success: false,
        error: {
          message: "Failed to create wallet",
          details: error,
        },
      };
    }
  }

  static async loadWallet(): Promise<ServiceResponse<WalletConfig>> {
    try {
      if (!fs.existsSync(WALLET_PATH)) {
        return {
          success: false,
          error: {
            message: "No wallet configured",
            code: "WALLET_NOT_FOUND",
          },
        };
      }

      const walletConfig = (await fs.readJSON(WALLET_PATH)) as WalletConfig;
      return { success: true, data: walletConfig };
    } catch (error) {
      return {
        success: false,
        error: {
          message: "Failed to load wallet",
          details: error,
        },
      };
    }
  }

  static getKeypair(walletConfig: WalletConfig): Keypair {
    return Keypair.fromSecretKey(Uint8Array.from(walletConfig.keypair));
  }

  static async importWallet(
    secretKeyString: string
  ): Promise<ServiceResponse<WalletConfig>> {
    try {
      let secretKey: number[];

      // Handle different formats of secret key
      if (secretKeyString.includes("[") && secretKeyString.includes("]")) {
        // It's an array string
        secretKey = JSON.parse(secretKeyString);
      } else {
        // It's a base58 string or path to a keypair file
        if (fs.existsSync(secretKeyString)) {
          // It's a file path
          const keyfileContent = await fs.readFile(secretKeyString, "utf-8");
          secretKey = JSON.parse(keyfileContent);
        } else {
          // It's a base58 string
          secretKey = Array.from(decode(secretKeyString));
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

      return { success: true, data: walletConfig };
    } catch (error) {
      return {
        success: false,
        error: {
          message: "Failed to import wallet",
          details: error,
        },
      };
    }
  }

  static async getBalance(
    connection: Connection,
    pubkey: string
  ): Promise<ServiceResponse<number>> {
    try {
      const balance = await connection.getBalance(new PublicKey(pubkey));
      return {
        success: true,
        data: balance / LAMPORTS_PER_SOL,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          message: "Failed to get wallet balance",
          details: error,
        },
      };
    }
  }

  static async getWalletInfo(
    connection: Connection,
    walletConfig?: WalletConfig
  ): Promise<ServiceResponse<WalletData>> {
    try {
      if (!walletConfig) {
        const walletResponse = await this.loadWallet();
        if (!walletResponse.success || !walletResponse.data) {
          return {
            success: false,
            error: {
              message: "No wallet configured",
              code: "WALLET_NOT_FOUND",
            },
          };
        }
        walletConfig = walletResponse.data;
      }

      const walletData: WalletData = {
        pubkey: walletConfig.pubkey,
      };

      // Try to get balance
      try {
        const balanceResponse = await this.getBalance(
          connection,
          walletConfig.pubkey
        );
        if (balanceResponse.success && balanceResponse.data !== undefined) {
          walletData.balance = balanceResponse.data;
        }
      } catch (error) {
        // Balance fetch failed, but we can still return other wallet info
        // We'll just leave the balance field undefined
      }

      return { success: true, data: walletData };
    } catch (error) {
      return {
        success: false,
        error: {
          message: "Failed to get wallet information",
          details: error,
        },
      };
    }
  }
}
