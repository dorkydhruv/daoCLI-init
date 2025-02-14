import { DAOConfig } from "../types/daoconfig";
import { resolve } from "path";
import { readFileSync } from "fs";

export function loadConfig(): DAOConfig {
  const configPath = resolve(`${process.cwd()}/cli`, "dao-config.json");
  const configtxt = readFileSync(configPath, "utf-8");
  return JSON.parse(configtxt);
}
