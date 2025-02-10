import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { DaoContract } from "../target/types/dao_contract";

describe("dao-contract", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.DaoContract as Program<DaoContract>;
});
