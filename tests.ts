//#mocha -r ts-node/register tests.ts

import { expect } from "chai";
import { PublicKey } from "@solana/web3.js";
import { SolanaClient, StarknetClient } from "./cli";

describe("SolanaClient", () => {
  const dummyWallet = { publicKey: new PublicKey("11111111111111111111111111111111") };
  const solClient = new SolanaClient(
    "https://api.mainnet-beta.solana.com",
    "dao11111111111111111111111111111111111111",
    dummyWallet
  );

  it("should initialize DAO and return dummy tx hash", async () => {
    const tx = await solClient.initializeDAO(1000, 7, 0.1);
    expect(tx).to.equal("solana_dummy_tx_hash");
  });

  it("should create pool and return dummy tx hash", async () => {
    const tx = await solClient.createPool(50, 1000000);
    expect(tx).to.equal("solana_pool_tx_hash");
  });
  
  it("should deploy DAO and return dummy deploy tx hash", async () => {
    const tx = await solClient.deployDAO();
    expect(tx).to.equal("solana_deploy_tx_hash");
  });
  
  it("should upgrade DAO and return dummy upgrade tx hash", async () => {
    const tx = await solClient.upgradeDAO(2);
    expect(tx).to.equal("solana_upgrade_tx_hash");
  });
});

describe("StarknetClient", () => {
  const starkClient = new StarknetClient(
    "https://starknet-mainnet.infura.io/v3/YOUR-PROJECT-ID",
    "0x123...abc"
  );

  it("should initialize DAO and return dummy tx hash", async () => {
    const tx = await starkClient.initializeDAO(1000, 7, 0.1);
    expect(tx).to.equal("starknet_dummy_tx_hash");
  });

  it("should create pool and return dummy tx hash", async () => {
    const tx = await starkClient.createPool(50, 1000000);
    expect(tx).to.equal("starknet_pool_tx_hash");
  });
  
  it("should deploy DAO and return dummy deploy tx hash", async () => {
    const tx = await starkClient.deployDAO();
    expect(tx).to.equal("starknet_deploy_tx_hash");
  });
  
  it("should upgrade DAO and return dummy upgrade tx hash", async () => {
    const tx = await starkClient.upgradeDAO(2);
    expect(tx).to.equal("starknet_upgrade_tx_hash");
  });
});
