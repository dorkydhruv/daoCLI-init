export interface DAOConfig {
  defaultNetwork: string;
  keypairPaths: {
    devnet: string;
    testnet: string;
    mainnet: string;
  };
}
