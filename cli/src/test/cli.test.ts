import { spawnSync } from "child_process";
import { expect } from "chai";
import path from "path";
import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { AgentManager } from "../lib/agent";
import { randomUUID } from "crypto";
import {
  createAssociatedTokenAccount,
  createMint,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

// Declare an array to store command outputs
const results: string[] = [];

describe("CLI Integration Tests (using devnet)", function () {
  // Get the default public key from your wallet configuration
  const agent = AgentManager.getInstance();
  const walletPublicKey = agent.wallet.publicKey;

  const dummyTargetAccount = "4tMN5HYmfpsAFgcxG2Ng14pfJwoy8f4Kz2V6n8tgPyim";
  let dummyMint: PublicKey;
  const description = "Devnet CLI Test Proposal";
  const amount = "1";
  const dummyId = randomUUID().substring(0, 8);
  const mintKeypair = anchor.web3.Keypair.generate();

  const [dummyProposalAccount, _] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("proposal"),
      Buffer.from(dummyId),
      new PublicKey(walletPublicKey).toBuffer(),
    ],
    new PublicKey("4ME7WnEPrZT6DtTva6c56z3nRewkZQLqRyJtM43T1KEE")
  );
  this.timeout(15000);

  // maybe switch to ts-node here?
  // Resolve the CLI entry file (adjust if necessary)
  const cliPath = path.resolve(__dirname, "../../dist/index.js");

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
    const tokenAccount = await createAssociatedTokenAccount(
      agent.program.provider.connection,
      agent.wallet.payer,
      dummyMint,
      agent.wallet.publicKey
    );
    await mintTo(
      agent.program.provider.connection,
      agent.wallet.payer,
      dummyMint,
      tokenAccount,
      agent.wallet.publicKey,
      mintAmount
    );
    const balance =
      await agent.program.provider.connection.getTokenAccountBalance(
        tokenAccount
      );
    expect(balance.value.amount.toString()).to.equal(mintAmount.toString());
  });

  it("should switch to devnet", () => {
    const result = spawnSync("node", [cliPath, "set-network", "devnet"], {
      encoding: "utf-8",
    });
    // Ensure stdout is defined before asserting string content.
    const stdout = result.stdout || "";
    expect(stdout).to.be.a("string");
    expect(stdout).to.contain("Switched to network devnet");
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
        dummyTargetAccount,
        "-m",
        dummyMint.toBase58(),
        "-d",
        description,
      ],
      { encoding: "utf-8" }
    );
    // checks if the proposal was created successfully
    expect(createResult.stdout).to.contain(
      `Creating proposal with ID ${dummyId.toString()} and description ${description} for target amount ${amount} to target account ${dummyTargetAccount.toString()}`
    );
    expect(createResult.stdout).to.contain(
      `Proposal created with publickey ${dummyProposalAccount.toBase58()}`
    );
    expect(createResult.stdout).to.contain("Transaction hash:");
    results.push(createResult.stdout);
  });

  it("should contribute to a proposal on devnet", () => {
    const contributeResult = spawnSync(
      "node",
      [cliPath, "contribute", dummyProposalAccount.toBase58(), amount],
      { encoding: "utf-8" }
    );

    // checks if the contribution was successful
    expect(contributeResult.stdout).to.contain(
      `Contributing ${amount} to proposal ${dummyProposalAccount.toBase58()}....`
    );
    expect(contributeResult.stdout).to.contain(
      `Contributed ${amount} (${dummyMint}) to proposal ${dummyProposalAccount.toBase58()}`
    );
    expect(contributeResult.stdout).to.contain("Transaction hash:");
    results.push(contributeResult.stdout);
  });

  it("should execute a proposal on devnet", () => {
    const executeResult = spawnSync(
      "node",
      [cliPath, "execute", dummyProposalAccount.toBase58()],
      { encoding: "utf-8" }
    );
    expect(executeResult.stdout).to.contain(
      `Executing proposal with ${dummyProposalAccount.toBase58()}...`
    );
    expect(executeResult.stdout).to.contain(
      `Proposal ${dummyProposalAccount.toBase58()} executed successfully`
    );
    expect(executeResult.stdout).to.contain("Transaction hash:");
    results.push(executeResult.stdout);
  });
});
