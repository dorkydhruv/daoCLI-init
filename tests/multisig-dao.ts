import * as anchor from "@coral-xyz/anchor";
import {
  createAssociatedTokenAccount,
  createMint,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Program } from "@coral-xyz/anchor";
import { MultisigDao } from "../target/types/multisig_dao";
import { assert } from "chai";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { BN } from "bn.js";

describe("multisig-dao", () => {
  const daoName = "dao";
  let mint: anchor.web3.PublicKey;
  let mintAccount: anchor.web3.PublicKey;
  let communityTokenHolding: anchor.web3.PublicKey;
  let councilTokenHolding: anchor.web3.PublicKey;
  let realmConfig: anchor.web3.PublicKey;
  let governedAccount: anchor.web3.PublicKey;
  let governance: anchor.web3.PublicKey;
  let nativeTreasury: anchor.web3.PublicKey;

  const councilMint = anchor.web3.Keypair.generate();
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const realmProgram = new anchor.web3.PublicKey(
    "GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw"
  );
  const wallet = provider.wallet as NodeWallet;
  const program = anchor.workspace.MultisigDao as Program<MultisigDao>;
  const [realmAccount] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("governance"), Buffer.from(daoName)],
    realmProgram
  );
  const mintKeypair = anchor.web3.Keypair.generate();

  before(async () => {
    // Create the community mint
    const amount = 20 * Math.pow(10, 6);
    mint = await createMint(
      provider.connection,
      wallet.payer,
      wallet.publicKey,
      null,
      6,
      mintKeypair,
      undefined,
      TOKEN_PROGRAM_ID
    );

    // Create the council mint
    await createMint(
      provider.connection,
      wallet.payer,
      wallet.publicKey,
      null,
      0, // 0 decimals for council mint
      councilMint,
      undefined,
      TOKEN_PROGRAM_ID
    );

    mintAccount = await createAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      mint,
      wallet.publicKey
    );
    await mintTo(
      provider.connection,
      wallet.payer,
      mint,
      mintAccount,
      wallet.publicKey,
      amount
    );

    // Compute dependent addresses now that mint is defined.
    [communityTokenHolding] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("governance"), realmAccount.toBytes(), mint.toBytes()],
      realmProgram
    );
    [councilTokenHolding] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("governance"),
        realmAccount.toBytes(),
        councilMint.publicKey.toBytes(),
      ],
      realmProgram
    );
    [realmConfig] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("realm-config"), realmAccount.toBytes()],
      realmProgram
    );
    governedAccount = anchor.web3.Keypair.generate().publicKey;
    [governance] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("account-governance"),
        realmAccount.toBytes(),
        governedAccount.toBytes(),
      ],
      realmProgram
    );
    [nativeTreasury] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("native-treasury"), governance.toBytes()],
      realmProgram
    );

    console.log("Mint:", mint.toBase58());
    console.log("Mint Account:", mintAccount.toBase58());
    console.log("Community Token Holding:", communityTokenHolding.toBase58());
    console.log("Council Token Holding:", councilTokenHolding.toBase58());
    console.log("Realm Config:", realmConfig.toBase58());
    console.log("Governed Account:", governedAccount.toBase58());
    console.log("Governance:", governance.toBase58());
    console.log("Native Treasury:", nativeTreasury.toBase58());
    console.log("Realm Account:", realmAccount.toBase58());
    console.log("Council Mint:", councilMint.publicKey.toBase58());
    console.log("Wallet:", wallet.publicKey.toBase58());
    console.log("Program ID:", program.programId.toBase58());
  });

  it("creates an SPL token", async () => {
    // Assert that mintAccount was created.
    const balance = await provider.connection.getTokenAccountBalance(
      mintAccount
    );
    const expected = (20 * Math.pow(10, 6)).toString();
    assert.equal(
      balance.value.amount.toString(),
      expected,
      "Balance should equal minted amount"
    );
  });

  it("Is initialized!", async () => {
    const tx = await program.methods.initialize().rpc();
  });

  it("Creates a DAO", async () => {
    const tx = await program.methods
      .createDao(daoName, new BN(100), new BN(1), false, 5, 30 * 60 * 60)
      .accounts({
        communityTokenHolding,
        councilTokenHolding: null,
        realmConfig,
        realmAccount,
        governedAccount,
        governance,
        nativeTreasury,
        signer: wallet.publicKey,
        mint,
        councilMint: null,
      })
      .rpc();

    console.log("Your transaction signature", tx);
  });
});
