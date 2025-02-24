import * as anchor from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccount,
  createMint,
  getAssociatedTokenAddressSync,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Program } from "@coral-xyz/anchor";
import { MultisigDao } from "../target/types/multisig_dao";
import { assert } from "chai";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { BN } from "bn.js";

describe("multisig-dao", () => {
  const provider = anchor.AnchorProvider.env();
  const wallet = provider.wallet as NodeWallet;
  const program = anchor.workspace.MultisigDao as Program<MultisigDao>;
  const daoName = "vao";
  const realmProgram = new anchor.web3.PublicKey(
    "GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw"
  );
  let councilMint: anchor.web3.PublicKey;
  const councilMintKeypair = anchor.web3.Keypair.generate();
  const [realmAccount] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("governance"), Buffer.from(daoName)],
    realmProgram
  );

  const [communityTokenHolding] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("governance"),
      realmAccount.toBytes(),
      councilMintKeypair.publicKey.toBytes(),
    ],
    realmProgram
  );

  const governedAccount = anchor.web3.Keypair.generate().publicKey;

  const [governance] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("account-governance"),
      realmAccount.toBytes(),
      governedAccount.toBytes(),
    ],
    realmProgram
  );
  anchor.setProvider(provider);

  before(async () => {
    councilMint = await createMint(
      provider.connection,
      wallet.payer,
      wallet.publicKey,
      null,
      0,
      councilMintKeypair,
      undefined,
      TOKEN_PROGRAM_ID
    );
    const walletTokenAccount = await createAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      wallet.publicKey,
      councilMint
    );
    await mintTo(
      provider.connection,
      wallet.payer,
      councilMint,
      walletTokenAccount,
      wallet.publicKey,
      100
    );
    console.log("councilMint", councilMint.toBase58());
  });

  it("Is initialized!", async () => {
    const tx = await program.methods.initialize().rpc();
  });
});
