// src/utils/googleAnalytics.ts
import axios from "axios";
import os from "os";
import path from "path";
import fs from "fs-extra";
import chalk from "chalk";
import { generateClientId } from "./salt";

// Functions to get directory paths at runtime
function getHomeDir(): string {
  return process.env.HOME || os.homedir();
}

function getConfigDir(): string {
  return path.join(getHomeDir(), ".config", "asset-cli");
}

function getGAFlagFile(): string {
  return path.join(getConfigDir(), "ga_telemetry_flag.json");
}

interface GATelemetryFlag {
  client_id: string;
  sent?: boolean;
  disabled?: boolean;
  timestamp: string;
}

const GA_MEASUREMENT_ID = "G-4NFRRB89Z6";
const GA_API_SECRET = "EAYlt2WrQ2KzrZiWpaqbAA";

// GA Measurement Protocol endpoint for GA4
const GA_ENDPOINT = `https://www.google-analytics.com/mp/collect?measurement_id=${GA_MEASUREMENT_ID}&api_secret=${GA_API_SECRET}`;

/**
 * Sends a one-time "first use" event to Google Analytics via the Measurement Protocol.
 * If the "--noga" flag is provided (noga = true) then telemetry is not sent,
 * and that preference is saved so that future runs never send telemetry.
 *
 * @param noga - If true, telemetry will be disabled.
 */
export async function sendFirstUseGATelemetry(
  noga: boolean = false
): Promise<void> {
  const configDir = getConfigDir();
  const gaFlagFile = getGAFlagFile();
  await fs.ensureDir(configDir);
  const flagFileExists = await fs.pathExists(gaFlagFile);

  if (flagFileExists) {
    const flagData: GATelemetryFlag = await fs.readJSON(gaFlagFile);
    if (flagData.disabled || flagData.sent) {
      return;
    }
  }

  // Get a persistent client id
  const clientId = await generateClientId();

  // If the "--noga" flag is provided, record telemetry as disabled.
  if (noga) {
    const flagData: GATelemetryFlag = {
      client_id: clientId,
      disabled: true,
      timestamp: new Date().toISOString(),
    };
    try {
      await fs.writeJSON(gaFlagFile, flagData);
    } catch (error) {
      console.error(`Error writing flag file:`, error);
    }

    console.log(chalk.yellow("telemetry is disabled"));
    return;
  }

  // Build the GA Measurement Protocol payload.
  const payload = {
    client_id: clientId,
    events: [
      {
        name: "cli_first_use",
        params: {
          timestamp: new Date().toISOString(),
          platform: os.platform(),
          release: os.release(),
          arch: os.arch(),
        },
      },
    ],
  };

  try {
    await axios.post(GA_ENDPOINT, payload, {
      headers: { "Content-Type": "application/json" },
    });
    const flagData: GATelemetryFlag = {
      client_id: clientId,
      sent: true,
      timestamp: new Date().toISOString(),
    };
    await fs.writeJSON(gaFlagFile, flagData);
    console.log(
      chalk.blueBright(`Telemetry: An anonymous usage event has been sent`)
    );
    console.log(
      chalk.blueBright(
        "We only send telemetry on the first CLI use and do not collect any personal data."
      )
    );
  } catch (error) {
    console.error(chalk.red(`Failed to send GA telemetry: ${error}`));
  }
}
