import { PublicKey } from "@solana/web3.js";
import { WalletService } from "../services/wallet-service";
import { ConnectionService } from "../services/connection-service";
import { ConfigService } from "../services/config-service";

type McpHookOptions = {
  requireWallet?: boolean;
  requireConfig?: boolean;
  requireDao?: boolean;
  requireMultisig?: boolean;
};

type McpHookResult = {
  success: boolean;
  error?: string;
  connection?: any;
  keypair?: any;
  config?: any;
  realmAddress?: PublicKey | undefined;
  multisigAddress?: PublicKey | undefined;
};

/**
 * Utility function that acts like a "hook" for MCP tools
 * Fetches wallet, connection, and configuration in one operation
 */
export async function useMcpContext(
  options: McpHookOptions = {}
): Promise<McpHookResult> {
  const {
    requireWallet = true,
    requireConfig = true,
    requireDao = false,
    requireMultisig = false,
  } = options;

  // Setup connection
  const connectionRes = await ConnectionService.getConnection();
  if (!connectionRes.success || !connectionRes.data) {
    return {
      success: false,
      error: "Failed to establish connection",
    };
  }
  const connection = connectionRes.data;

  // Get wallet if required
  let keypair = undefined;
  if (requireWallet) {
    const walletRes = await WalletService.loadWallet();
    if (!walletRes.success || !walletRes.data) {
      return {
        success: false,
        error: "No wallet configured. Please create a wallet first.",
      };
    }
    keypair = WalletService.getKeypair(walletRes.data);
  }

  // Get config if required
  let config = undefined;
  if (requireConfig) {
    const configRes = await ConfigService.getConfig();
    if (!configRes.success || !configRes.data) {
      return {
        success: false,
        error: "Failed to load configuration",
      };
    }
    config = configRes.data;
  }

  // Check for DAO if required
  let realmAddress = undefined;
  if (requireDao) {
    if (!config?.dao?.activeRealm) {
      return {
        success: false,
        error: "No DAO configured. Use useDao to select one.",
      };
    }
    realmAddress = new PublicKey(config.dao.activeRealm);
  }

  // Check for standalone multisig if required
  let multisigAddress = undefined;
  if (requireMultisig) {
    const multisigRes = await ConfigService.getActiveSquadsMultisig();
    if (!multisigRes.success || !multisigRes.data) {
      return {
        success: false,
        error:
          "No standalone multisig configured. Use setMultisigAddress to configure one.",
      };
    }
    multisigAddress = new PublicKey(multisigRes.data);
  }

  return {
    success: true,
    connection,
    keypair,
    config,
    realmAddress,
    multisigAddress,
  };
}