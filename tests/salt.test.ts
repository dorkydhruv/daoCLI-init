import { expect } from "chai";
import fs from "fs-extra";
import os from "os";
import path from "path";
import { getOrCreateSalt, generateClientId } from "../src/utils/salt";

describe("Salt Module", () => {
  // Override HOME for testing purposes.
  const originalHome = process.env.HOME;
  const testHome = path.join(os.tmpdir(), "dao-cli-test-home");

  before(async () => {
    process.env.HOME = testHome;
    // Remove any previous config so tests start fresh.
    await fs.remove(path.join(testHome, ".config", "asset-cli"));
  });

  after(async () => {
    await fs.remove(path.join(testHome, ".config", "asset-cli"));
    process.env.HOME = originalHome;
  });

  it("should create a persistent salt", async () => {
    const salt1 = await getOrCreateSalt();
    expect(salt1).to.be.a("string").with.length.greaterThan(0);
    // Calling again returns the same salt
    const salt2 = await getOrCreateSalt();
    expect(salt2).to.equal(salt1);
  });

  it("should generate a consistent client id", async () => {
    const clientId1 = await generateClientId();
    const clientId2 = await generateClientId();
    // SHA-256 hash in hex produces 64 characters.
    expect(clientId1).to.be.a("string").with.length(64);
    expect(clientId2).to.equal(clientId1);
  });
});
