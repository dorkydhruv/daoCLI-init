import { expect } from "chai";
import fs from "fs-extra";
import os from "os";
import path from "path";
import sinon from "sinon";
import axios from "axios";
import { sendFirstUseGATelemetry } from "./../src/utils/googleAnalytics";
import dotenv from "dotenv";
dotenv.config();

describe("Google Analytics Telemetry", () => {
  const originalHome = process.env.HOME;
  const testHome = path.join(os.tmpdir(), "dao-cli-test-home");
  const CONFIG_DIR = path.join(testHome, ".config", "asset-cli");
  const GA_FLAG_FILE = path.join(CONFIG_DIR, "ga_telemetry_flag.json");

  before(async () => {
    process.env.HOME = testHome;
    await fs.remove(CONFIG_DIR);
  });

  after(async () => {
    await fs.remove(CONFIG_DIR);
    process.env.HOME = originalHome;
  });

  afterEach(async () => {
    sinon.restore();
    if (await fs.pathExists(GA_FLAG_FILE)) {
      await fs.remove(GA_FLAG_FILE);
    }
  });

  it("should record telemetry as disabled when --noga flag is provided", async () => {
    const consoleLogStub = sinon.stub(console, "log");
    await sendFirstUseGATelemetry(true);

    // Wait a bit to ensure file operations complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    const exists = await fs.pathExists(GA_FLAG_FILE);

    expect(exists).to.be.true;

    if (exists) {
      const flagData = await fs.readJSON(GA_FLAG_FILE);
      console.log(`Flag data:`, flagData);
      expect(flagData.disabled).to.be.true;
      expect(consoleLogStub.calledWithMatch("telemetry is disabled")).to.be
        .true;
    }
  });

  it("should send telemetry and record flag when not disabled", async () => {
    // Stub axios.post to simulate a successful telemetry post.
    const axiosPostStub = sinon.stub(axios, "post").resolves({ status: 200 });
    const consoleLogStub = sinon.stub(console, "log");

    await sendFirstUseGATelemetry(false);
    expect(axiosPostStub.calledOnce).to.be.true;
    expect(await fs.pathExists(GA_FLAG_FILE)).to.be.true;
    const flagData = await fs.readJSON(GA_FLAG_FILE);
    expect(flagData.sent).to.be.true;
    expect(
      consoleLogStub.calledWithMatch(
        "Telemetry: An anonymous usage event has been sent"
      )
    ).to.be.true;
  });

  it("should not send telemetry if flag file already exists", async () => {
    // Pre-create the GA flag file indicating telemetry was already sent.
    await fs.ensureDir(CONFIG_DIR);
    await fs.writeJSON(GA_FLAG_FILE, {
      client_id: "dummy",
      sent: true,
      timestamp: new Date().toISOString(),
    });
    const axiosPostStub = sinon.stub(axios, "post");
    await sendFirstUseGATelemetry(false);
    expect(axiosPostStub.called).to.be.false;
  });
});
