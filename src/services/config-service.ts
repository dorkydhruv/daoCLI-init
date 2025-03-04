import fs from "fs-extra";
import {
  CONFIG_PATH,
  CONFIG_DIR,
  DEFAULT_CLUSTER,
  ENDPOINT_MAP,
} from "../utils/constants";
import { Config, DaoConfig } from "../types";
import { Cluster } from "@solana/web3.js";

export class ConfigService {
  static async getConfig(): Promise<Config> {
    await fs.ensureDir(CONFIG_DIR);

    if (!fs.existsSync(CONFIG_PATH)) {
      const defaultConfig: Config = {
        dao: {
          cluster: DEFAULT_CLUSTER as Cluster,
          endpoint: ENDPOINT_MAP[DEFAULT_CLUSTER as Cluster],
        },
      };
      await fs.writeJSON(CONFIG_PATH, defaultConfig, { spaces: 2 });
      return defaultConfig;
    }

    return fs.readJSON(CONFIG_PATH) as Promise<Config>;
  }

  static async saveConfig(config: Config): Promise<void> {
    await fs.ensureDir(CONFIG_DIR);
    await fs.writeJSON(CONFIG_PATH, config, { spaces: 2 });
  }

  static async updateDaoConfig(daoConfig: Partial<DaoConfig>): Promise<Config> {
    const config = await this.getConfig();

    config.dao = {
      ...config.dao,
      ...daoConfig,
    } as DaoConfig;

    await this.saveConfig(config);
    return config;
  }

  static async setActiveRealm(realmAddress: string): Promise<Config> {
    return this.updateDaoConfig({ activeRealm: realmAddress });
  }

  static async setActiveMultisig(multisigAddress: string): Promise<Config> {
    return this.updateDaoConfig({ activeMultisig: multisigAddress });
  }

  static async setCluster(
    cluster: Cluster,
    endpoint?: string
  ): Promise<Config> {
    const effectiveEndpoint = endpoint || ENDPOINT_MAP[cluster];
    return this.updateDaoConfig({
      cluster,
      endpoint: effectiveEndpoint,
    });
  }
}
