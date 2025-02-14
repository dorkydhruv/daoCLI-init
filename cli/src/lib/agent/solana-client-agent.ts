import { AnchorProvider, Idl, Program, Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import IDL from "../../../dao_contract.json";
import { readFileSync } from "fs";
import { DaoContract } from "../../types/dao_contract";
import { resolve } from "path";
export { SolanaClientAgent };
class SolanaClientAgent {
  private provider: AnchorProvider;
  public program: Program<DaoContract>;
  public wallet: Wallet;
  public network: string;

  constructor(
    network: "devnet" | "testnet" | "mainnet",
    keypairPath: string,
    testKeypair?: Keypair
  ) {
    this.network = network;
    const { rpcUrl } = this.getNetworkConfig(network);
    const keypair = testKeypair ?? this.loadKeypair(keypairPath);
    const connection = new Connection(rpcUrl, "confirmed");
    const wallet = new Wallet(keypair);
    this.wallet = wallet;
    this.provider = new AnchorProvider(connection, wallet, {});
    this.program = new Program<DaoContract>(IDL as DaoContract, this.provider);
  }

  private getNetworkConfig(network: "devnet" | "testnet" | "mainnet") {
    const networks = {
      devnet: {
        rpcUrl: "https://api.devnet.solana.com",
      },
      testnet: {
        rpcUrl: "https://api.testnet.solana.com",
      },
      mainnet: {
        rpcUrl: "https://api.mainnet-beta.solana.com",
      },
    };
    return networks[network];
  }

  private loadKeypair(path: string): Keypair {
    const walletPath = resolve(process.cwd(), path);
    const content = readFileSync(walletPath, "utf-8");
    const secretKeyArray = JSON.parse(content);
    if (!Array.isArray(secretKeyArray) || secretKeyArray.length !== 64) {
      throw new Error("Invalid secret key");
    }
    const secretKey = new Uint8Array(secretKeyArray);
    return Keypair.fromSecretKey(secretKey);
  }
}
