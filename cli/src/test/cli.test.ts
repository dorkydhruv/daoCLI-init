import { spawnSync } from "child_process";
import { expect } from "chai";
import path from "path";
import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import { AgentManager } from "../lib/agent";
import { randomUUID } from "crypto";
import {
  createAssociatedTokenAccount,
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { SolanaClientAgent } from "../lib/agent/solana-client-agent";

// Utility delay function
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Declare an array to store command outputs
const results: string[] = [];
let agent: SolanaClientAgent;

// Move variables that depend on agent into before hook
let dummyProposalAccount: PublicKey;
let dummyMint: PublicKey;
let dummyTargetAccount: Keypair;
let dummyId: string;
const description = "Devnet CLI Test Proposal";
const amount = "1";
const mintKeypair = anchor.web3.Keypair.generate();

// Resolve the CLI entry file (adjust if necessary)
const cliPath = path.resolve(__dirname, "../../dist/index.js");

describe("CLI Integration Tests (using devnet)", function () {
  this.timeout(30000); // Increase timeout to allow delays

  before(async () => {
    agent = await AgentManager.getTestInstance();
    dummyTargetAccount = Keypair.generate();
    dummyId = randomUUID().substring(0, 8);
    [dummyProposalAccount] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("proposal"),
        Buffer.from(dummyId),
        new PublicKey(agent.wallet.publicKey).toBuffer(),
      ],
      agent.program.programId
    );
  });

  after(() => {
    console.log("\n--- Command Outputs Summary ---");
    results.forEach((output, index) => {
      console.log(`Output ${index + 1}:\n${output}\n`);
    });
  });

  it("creates a SPL token", async () => {
    const mintAmount = 20 * Math.pow(10, 6);
    dummyMint = await createMint(
      agent.program.provider.connection,
      agent.wallet.payer,
      agent.wallet.publicKey,
      null,
      6,
      mintKeypair,
      undefined,
      TOKEN_PROGRAM_ID
    );
    const signerTokenAccount = await createAssociatedTokenAccount(
      agent.program.provider.connection,
      agent.wallet.payer,
      dummyMint,
      agent.wallet.publicKey
    );
    await mintTo(
      agent.program.provider.connection,
      agent.wallet.payer,
      dummyMint,
      signerTokenAccount,
      agent.wallet.publicKey,
      mintAmount
    );
    const balance =
      await agent.program.provider.connection.getTokenAccountBalance(
        signerTokenAccount
      );
    expect(balance.value.amount.toString()).to.equal(mintAmount.toString());
  });

  it("should switch to devnet", () => {
    const result = spawnSync("node", [cliPath, "set-network", "devnet"], {
      encoding: "utf-8",
    });
    const stdout = result.stdout || "";
    expect(agent.network).to.equal("devnet");
    results.push(stdout);
  });

  it("should create a proposal on devnet", async () => {
    const createResult = spawnSync(
      "node",
      [
        cliPath,
        "create",
        "-i",
        dummyId,
        "-a",
        amount,
        "-t",
        dummyTargetAccount.publicKey.toBase58(),
        "-m",
        dummyMint.toBase58(),
        "-d",
        description,
      ],
      { encoding: "utf-8" }
    );
    results.push(createResult.stdout);
    // Wait additional time for the transaction to be finalized.
    await sleep(10000);
    const accountInfo = await agent.program.account.proposal.fetch(
      dummyProposalAccount
    );
    expect(accountInfo.id).to.equal(dummyId);
    expect(accountInfo.description).to.equal(description);
  });

  it("should contribute to a proposal on devnet", async () => {
    const contributeResult = spawnSync(
      "node",
      [cliPath, "contribute", dummyProposalAccount.toBase58(), amount],
      { encoding: "utf-8" }
    );
    results.push(contributeResult.stdout);
    // Allow time for the contribution transaction to complete.
    await sleep(10000);
    const targetTokenAccount = await getOrCreateAssociatedTokenAccount(
      agent.program.provider.connection,
      agent.wallet.payer,
      dummyMint,
      dummyTargetAccount.publicKey
    );
    const targetTokenAccountBalance =
      await agent.program.provider.connection.getTokenAccountBalance(
        targetTokenAccount.address
      );
    expect(
      (Number(targetTokenAccountBalance.value.amount) / 10 ** 6).toString()
    ).to.equal(amount);
  });

  it("should execute a proposal on devnet", async () => {
    const executeResult = spawnSync(
      "node",
      [cliPath, "execute", dummyProposalAccount.toBase58()],
      { encoding: "utf-8" }
    );
    results.push(executeResult.stdout);
    // Wait for execution transaction finalization.
    await sleep(10000);
    const targetTokenAccount = await getOrCreateAssociatedTokenAccount(
      agent.program.provider.connection,
      agent.wallet.payer,
      dummyMint,
      dummyTargetAccount.publicKey
    );
    const targetTokenAccountBalance =
      await agent.program.provider.connection.getTokenAccountBalance(
        targetTokenAccount.address
      );
    expect(
      (Number(targetTokenAccountBalance.value.amount) / 10 ** 6).toString()
    ).to.equal(amount);
  });
});
