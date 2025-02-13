import { spawnSync } from "child_process";
import { expect } from "chai";
import path from "path";

// Declare an array to store command outputs
const results: string[] = [];

describe("CLI Integration Tests (using devnet)", function () {
  this.timeout(15000);
  // Resolve the CLI entry file (adjust if necessary)
  const cliPath = path.resolve(__dirname, "../../dist/index.js");

  after(() => {
    console.log("\n--- Command Outputs Summary ---");
    results.forEach((output, index) => {
      console.log(`Output ${index + 1}:\n${output}\n`);
    });
  });

  it("should switch to devnet", () => {
    const result = spawnSync("node", [cliPath, "set-network", "devnet"], {
      encoding: "utf-8",
    });
    // Ensure stdout is defined before asserting string content.
    const stdout = result.stdout || "";
    expect(stdout).to.be.a("string");
    expect(stdout).to.contain("Switched to network devnet");
    // Store output
    results.push(stdout);
  });

  it("should create a proposal on devnet", async () => {
    // Provide dummy addresses that work on devnet
    const dummyTargetAccount = "4tMN5HYmfpsAFgcxG2Ng14pfJwoy8f4Kz2V6n8tgPyim";
    const dummyMint = "5ZitPreB9gJqZqhKrDTcBstUcA7rHth1VFiBcAYeFK7q";
    const description = "Devnet CLI Test Proposal";
    const createResult = spawnSync(
      "node",
      [
        cliPath,
        "create",
        "-a",
        "1",
        "-t",
        dummyTargetAccount,
        "-m",
        dummyMint,
        "-d",
        description,
      ],
      { encoding: "utf-8" }
    );
    // Check that the CLI printed messages indicating proposal creation.
    expect(createResult.stdout).to.contain("Creating proposal with ID");
    expect(createResult.stdout).to.contain(description);
    expect(createResult.stdout).to.contain("Transaction hash:");
    // Store output
    results.push(createResult.stdout);
  });

  it("should contribute to a proposal on devnet", () => {
    // For CLI testing, pass a dummy proposal ID that the CLI would echo back.
    // In a real setup, the proposal should be created first.
    const dummyProposalId = "7VkoPJ2dJE3Axz63zarRQSamqB1cMRcTYBvEco7bHp7R";
    const contributionAmount = "1";

    const contributeResult = spawnSync(
      "node",
      [cliPath, "contribute", dummyProposalId, contributionAmount],
      { encoding: "utf-8" }
    );
    expect(contributeResult.stdout).to.contain(
      `Contribute ${contributionAmount} to proposal with ID ${dummyProposalId}`
    );
    // Store output
    results.push(contributeResult.stdout);
  });

  it("should execute a proposal on devnet", () => {
    // For CLI testing, use a dummy proposal ID.
    const dummyProposalId = "7VkoPJ2dJE3Axz63zarRQSamqB1cMRcTYBvEco7bHp7R";
    const executeResult = spawnSync(
      "node",
      [cliPath, "execute", dummyProposalId],
      { encoding: "utf-8" }
    );

    expect(executeResult.stdout).to.contain(
      `Executing proposal with ID ${dummyProposalId}`
    );
    // Store output
    results.push(executeResult.stdout);
  });
});
