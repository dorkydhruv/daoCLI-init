import { Connection, Commitment } from "@solana/web3.js";
import { ConfigService } from "./config-service";
import {
  ENDPOINT_MAP,
  DEFAULT_CLUSTER,
  ENDPOINT_LOCALHOST,
} from "../utils/constants";

export class ConnectionService {
  static async getConnection(
    commitment: Commitment = "confirmed"
  ): Promise<Connection> {
    try {
      const config = await ConfigService.getConfig();

      if (!config.dao?.endpoint) {
        console.warn("No RPC endpoint configured, using default");
        return new Connection(ENDPOINT_MAP[DEFAULT_CLUSTER], commitment);
      }

      // Create the connection
      const connection = new Connection(config.dao.endpoint, commitment);

      // Test the connection by making a simple call
      try {
        await connection.getVersion();
      } catch (error) {
        console.error(`Connection failed to ${config.dao.endpoint}: ${error}`);
        console.warn("Falling back to default connection");
        return new Connection(ENDPOINT_MAP[DEFAULT_CLUSTER], commitment);
      }

      return connection;
    } catch (error) {
      console.error(`Failed to create connection: ${error}`);
      console.warn("Falling back to default connection");

      // Fallback to default connection
      return new Connection(ENDPOINT_MAP[DEFAULT_CLUSTER], commitment);
    }
  }
}
