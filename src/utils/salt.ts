// src/utils/salt.ts
import crypto from "crypto";
import os from "os";
import fs from "fs-extra";
import path from "path";

// Functions to get directory paths at runtime
function getHomeDir(): string {
  return process.env.HOME || os.homedir();
}

function getConfigDir(): string {
  return path.join(getHomeDir(), ".config", "asset-cli");
}

function getMachineSaltFile(): string {
  return path.join(getConfigDir(), "machine_salt.json");
}

/**
 * Get (or create) a persistent salt for the machine.
 */
export async function getOrCreateSalt(): Promise<string> {
  const configDir = getConfigDir();
  const machineSaltFile = getMachineSaltFile();

  await fs.ensureDir(configDir);
  if (await fs.pathExists(machineSaltFile)) {
    const saltData = await fs.readJSON(machineSaltFile);
    return saltData.salt;
  } else {
    const salt = crypto.randomBytes(16).toString("hex");
    await fs.writeJSON(machineSaltFile, { salt });
    return salt;
  }
}

/**
 * Generate a persistent anonymous client ID using OS info and the persistent salt.
 */
export async function generateClientId(): Promise<string> {
  const salt = await getOrCreateSalt();
  const data = `${os.hostname()}|${os.platform()}|${os.arch()}|${os.release()}|${salt}`;
  return crypto.createHash("sha256").update(data).digest("hex");
}
