import { AgentManager } from "../cli/dist/lib/agent/index.js"; // changed from directory import

async function updateKeypair() {
  await AgentManager.getTestInstance();
  console.log("Updated devnet keypair.");
  process.exit(0);
}

updateKeypair().catch((err) => {
  console.error("Error updating keypair:", err);
  process.exit(1);
});
