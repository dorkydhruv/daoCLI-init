import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  getMint,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
} from "@solana/spl-token";
import { GovernanceService } from "./governance-service";
import { SplGovernance } from "governance-idl-sdk";
import { SPL_GOVERNANCE_PROGRAM_ID } from "../utils/constants";
import * as multisig from "@sqds/multisig";
import { MultisigService } from "./multisig-service";

/**
 * Service for managing proposals and transfers in the DAO
 */
export class ProposalService {
  static programId = new PublicKey(SPL_GOVERNANCE_PROGRAM_ID);

  // Constants for proposal description parsing
  private static readonly MULTISIG_TAG = "--- MULTISIG TRANSACTION INFO ---";
  private static readonly MULTISIG_ADDRESS_PREFIX = "Multisig Address: ";
  private static readonly TX_INDEX_PREFIX = "Transaction Index: ";

  /**
   * Creates a transfer SOL instruction to be used in a proposal
   * @param connection Solana connection
   * @param realmAddress Realm address
   * @param amount Amount of SOL to transfer
   * @param recipientAddress Recipient address
   * @returns Instruction for SOL transfer
   */
  static async getSolTransferInstruction(
    connection: Connection,
    realmAddress: PublicKey,
    amount: number | bigint,
    recipientAddress: PublicKey
  ): Promise<TransactionInstruction> {
    const splGovernance = new SplGovernance(connection, this.programId);

    // Get the governance account for the realm
    const governanceId = splGovernance.pda.governanceAccount({
      realmAccount: realmAddress,
      seed: realmAddress,
    }).publicKey;

    // Get the native treasury account
    const nativeTreasuryId = splGovernance.pda.nativeTreasuryAccount({
      governanceAccount: governanceId,
    }).publicKey;

    console.log(
      `Creating SOL transfer instruction from treasury ${nativeTreasuryId.toBase58()}`
    );

    // Calculate lamports
    const lamports =
      typeof amount === "number"
        ? amount * LAMPORTS_PER_SOL
        : amount * BigInt(LAMPORTS_PER_SOL);

    // Create transfer instruction
    return SystemProgram.transfer({
      fromPubkey: nativeTreasuryId,
      toPubkey: recipientAddress,
      lamports: typeof lamports === "bigint" ? Number(lamports) : lamports,
    });
  }

  /**
   * Creates a transfer SPL token instruction to be used in a proposal
   */
  static async getTokenTransferInstruction(
    connection: Connection,
    realmAddress: PublicKey,
    tokenMint: PublicKey,
    amount: number | bigint,
    recipientAddress: PublicKey
  ): Promise<TransactionInstruction[]> {
    const splGovernance = new SplGovernance(connection, this.programId);

    // Get the governance account for the realm
    const governanceId = splGovernance.pda.governanceAccount({
      realmAccount: realmAddress,
      seed: realmAddress,
    }).publicKey;

    // Get the native treasury account
    const nativeTreasuryId = splGovernance.pda.nativeTreasuryAccount({
      governanceAccount: governanceId,
    }).publicKey;

    // Get token accounts
    const sourceTokenAccount = getAssociatedTokenAddressSync(
      tokenMint,
      nativeTreasuryId,
      true // Allow PDA
    );

    const recipientTokenAccount = getAssociatedTokenAddressSync(
      tokenMint,
      recipientAddress,
      true
    );

    // Check if recipient token account exists
    const instructions: TransactionInstruction[] = [];
    const recipientAccountInfo = await connection.getAccountInfo(
      recipientTokenAccount
    );

    if (!recipientAccountInfo) {
      console.log(
        `Creating associated token account for recipient: ${recipientAddress.toBase58()}`
      );

      instructions.push(
        createAssociatedTokenAccountInstruction(
          nativeTreasuryId, // payer (will be replaced by treasury in execution)
          recipientTokenAccount,
          recipientAddress,
          tokenMint
        )
      );
    }

    // Get token info for decimals
    const tokenInfo = await getMint(connection, tokenMint);

    // Calculate transfer amount with decimals
    const adjustedAmount =
      typeof amount === "number"
        ? amount * Math.pow(10, tokenInfo.decimals)
        : amount * BigInt(Math.pow(10, tokenInfo.decimals));

    // Add transfer instruction
    instructions.push(
      createTransferInstruction(
        sourceTokenAccount,
        recipientTokenAccount,
        nativeTreasuryId, // authority
        typeof adjustedAmount === "bigint"
          ? Number(adjustedAmount)
          : adjustedAmount
      )
    );

    return instructions;
  }

  /**
   * Creates a transfer SOL instruction for the Squads multisig
   */
  static async getSquadsMultisigSolTransferInstruction(
    connection: Connection,
    multisigAddress: PublicKey,
    amount: number | bigint,
    recipientAddress: PublicKey
  ): Promise<TransactionInstruction> {
    // Get the Squads vault PDA for index 0
    const vaultPda = MultisigService.getMultisigVaultPda(multisigAddress);

    // Calculate lamports
    const lamports =
      typeof amount === "number"
        ? amount * LAMPORTS_PER_SOL
        : amount * BigInt(LAMPORTS_PER_SOL);

    // Create the inner transfer instruction that will be executed by the vault
    // This is what will actually move SOL from the vault to the recipient
    const transferInstruction = SystemProgram.transfer({
      fromPubkey: vaultPda,
      toPubkey: recipientAddress,
      lamports: typeof lamports === "bigint" ? Number(lamports) : lamports,
    });

    // Build a transaction message with our transfer instruction
    // This is what the vault will execute when the multisig transaction is approved and executed
    // Note we're returning the transfer instruction directly, as it will be wrapped in createIntegratedAssetTransferProposal
    return transferInstruction;
  }

  /**
   * Creates a transfer SPL token instruction for the Squads multisig
   */
  static async getSquadsMultisigTokenTransferInstruction(
    connection: Connection,
    multisigAddress: PublicKey,
    tokenMint: PublicKey,
    amount: number | bigint,
    recipientAddress: PublicKey
  ): Promise<TransactionInstruction[]> {
    // Get the Squads vault PDA for index 0
    const vaultPda = MultisigService.getMultisigVaultPda(multisigAddress);
    // Get token accounts
    const sourceTokenAccount = getAssociatedTokenAddressSync(
      tokenMint,
      vaultPda,
      true // Allow PDA
    );
    const recipientTokenAccount = getAssociatedTokenAddressSync(
      tokenMint,
      recipientAddress,
      true
    );
    const instructions: TransactionInstruction[] = [];
    const recipientAccountInfo = await connection.getAccountInfo(
      recipientTokenAccount
    );
    if (!recipientAccountInfo) {
      console.log(
        `Creating associated token account for recipient: ${recipientAddress.toBase58()}`
      );
      instructions.push(
        createAssociatedTokenAccountInstruction(
          vaultPda, // payer
          recipientTokenAccount,
          recipientAddress,
          tokenMint
        )
      );
    }
    // Get token info for decimals
    const tokenInfo = await getMint(connection, tokenMint);
    // Calculate transfer amount with decimals
    const adjustedAmount =
      typeof amount === "number"
        ? amount * Math.pow(10, tokenInfo.decimals)
        : amount * BigInt(Math.pow(10, tokenInfo.decimals));
    // Add transfer instruction
    instructions.push(
      createTransferInstruction(
        sourceTokenAccount,
        recipientTokenAccount,
        vaultPda, // authority
        typeof adjustedAmount === "bigint"
          ? Number(adjustedAmount)
          : adjustedAmount
      )
    );
    return instructions;
  }

  /**
   * Create a proposal to transfer assets from the Squads multisig via DAO
   * This creates an integrated proposal with embedded multisig information
   */
  static async createIntegratedAssetTransferProposal(
    connection: Connection,
    keypair: Keypair,
    realmAddress: PublicKey,
    title: string,
    description: string,
    instructions: TransactionInstruction[]
  ): Promise<PublicKey> {
    console.log("Creating integrated proposal between DAO and Squads multisig");

    // Find the multisig associated with this realm
    const multisigAddress = MultisigService.getMultisigForRealm(realmAddress);
    console.log(`Using multisig: ${multisigAddress.toBase58()}`);

    const { transactionIndex } =
      await MultisigService.createTransactionWithProposal(
        connection,
        multisigAddress,
        keypair,
        instructions,
        title
      );

    // Include multisig info in the description
    const enhancedDescription =
      `${description}\n\n` +
      `${this.MULTISIG_TAG}\n` +
      `${this.MULTISIG_ADDRESS_PREFIX}${multisigAddress.toBase58()}\n` +
      `${this.TX_INDEX_PREFIX}${transactionIndex}\n` +
      `----------------------------`;

    // Now create the DAO proposal
    console.log(
      "Creating DAO proposal with embedded multisig transaction reference"
    );
    const proposalAddress = await this.createProposal(
      connection,
      keypair,
      realmAddress,
      title,
      enhancedDescription,
      [] // empty instructions array as the actual execution happens in the multisig
    );

    console.log(`
        Integrated proposal created successfully!
        DAO Proposal: ${proposalAddress.toBase58()}
        Multisig Address: ${multisigAddress.toBase58()}
        Transaction Index: ${transactionIndex}
        When the DAO proposal is executed, it will also execute the transaction on multisigPda.
    `);
    return proposalAddress;
  }

  /**
   * Fund either the native DAO treasury or the Squads multisig
   * @param connection Solana connection
   * @param keypair Wallet keypair
   * @param targetAddress The treasury or multisig address to fund
   * @param amount Amount of SOL to transfer
   * @returns Transaction signature
   */
  static async fundTreasury(
    connection: Connection,
    keypair: Keypair,
    targetAddress: PublicKey,
    amount: number
  ): Promise<string> {
    console.log(`Funding ${targetAddress.toBase58()} with ${amount} SOL...`);

    // Create transfer instruction
    const transferIx = SystemProgram.transfer({
      fromPubkey: keypair.publicKey,
      toPubkey: targetAddress,
      lamports: amount * LAMPORTS_PER_SOL,
    });

    // Use the executeInstructions method from MultisigService
    const signature = await MultisigService.executeInstructions(
      connection,
      keypair,
      [transferIx]
    );

    console.log(`Successfully funded with signature: ${signature}`);
    return signature;
  }

  /**
   * Fund a token account for a recipient
   * @param connection Solana connection
   * @param keypair Wallet keypair
   * @param tokenMint Token mint address
   * @param recipient Recipient address
   * @param amount Amount of tokens to transfer (decimal)
   * @returns Transaction signature
   */
  static async fundTokenAccount(
    connection: Connection,
    keypair: Keypair,
    tokenMint: PublicKey,
    recipient: PublicKey,
    amount: number
  ): Promise<string> {
    console.log(
      `Funding token account for ${recipient.toBase58()} with ${amount} tokens...`
    );

    // Get token info for decimals
    const tokenInfo = await getMint(connection, tokenMint);
    console.log(
      `Token mint: ${tokenMint.toBase58()}, decimals: ${tokenInfo.decimals}`
    );

    // Find source token account
    const sourceAccounts = await connection.getParsedTokenAccountsByOwner(
      keypair.publicKey,
      { mint: tokenMint }
    );

    if (!sourceAccounts.value || sourceAccounts.value.length === 0) {
      throw new Error(
        `No token accounts found for mint ${tokenMint.toBase58()}`
      );
    }

    // Use the first account that has enough tokens
    const sourceAccount = sourceAccounts.value[0].pubkey;
    console.log(`Using source account: ${sourceAccount.toBase58()}`);

    // Calculate the destination token account (ATA)
    const destinationAccount = getAssociatedTokenAddressSync(
      tokenMint,
      recipient,
      true // Allow PDA owners
    );

    // Check if destination account exists
    const instructions: TransactionInstruction[] = [];
    const destinationAccountInfo = await connection.getAccountInfo(
      destinationAccount
    );

    // Create destination account if needed
    if (!destinationAccountInfo) {
      console.log(
        `Creating token account for recipient: ${recipient.toBase58()}`
      );
      instructions.push(
        createAssociatedTokenAccountInstruction(
          keypair.publicKey,
          destinationAccount,
          recipient,
          tokenMint
        )
      );
    }

    // Calculate token amount with decimals
    const adjustedAmount = amount * Math.pow(10, tokenInfo.decimals);

    // Add transfer instruction
    instructions.push(
      createTransferInstruction(
        sourceAccount,
        destinationAccount,
        keypair.publicKey,
        Math.floor(adjustedAmount)
      )
    );

    // Execute instructions
    const signature = await MultisigService.executeInstructions(
      connection,
      keypair,
      instructions
    );

    console.log(`Token transfer complete with signature: ${signature}`);
    return signature;
  }

  /**
   * Ensures a token owner record exists for the user
   * Modified to use MultisigService.executeInstructions
   */
  static async ensureTokenOwnerRecord(
    connection: Connection,
    keypair: Keypair,
    realmAddress: PublicKey
  ): Promise<PublicKey> {
    const splGovernance = new SplGovernance(connection, this.programId);

    // Get realm info to find the council mint
    console.log(`Getting realm info for ${realmAddress.toBase58()}...`);

    try {
      const realmInfo = await splGovernance.getRealmByPubkey(realmAddress);
      const councilMint = realmInfo.config.councilMint;

      if (!councilMint) {
        throw new Error("Council mint not found for this realm");
      }

      console.log(`Using council mint: ${councilMint.toBase58()}`);

      // Check if token owner record already exists
      const tokenOwnerRecordPda = splGovernance.pda.tokenOwnerRecordAccount({
        realmAccount: realmAddress,
        governingTokenMintAccount: councilMint,
        governingTokenOwner: keypair.publicKey,
      });

      console.log(
        `Checking token owner record at ${tokenOwnerRecordPda.publicKey.toBase58()}`
      );

      try {
        const tokenOwnerRecord =
          await splGovernance.getTokenOwnerRecordByPubkey(
            tokenOwnerRecordPda.publicKey
          );
        console.log(
          "Token owner record exists:",
          tokenOwnerRecord.publicKey.toBase58()
        );
        return tokenOwnerRecordPda.publicKey;
      } catch (err) {
        console.log("Token owner record does not exist, creating it now...");

        // Create token owner record instruction
        const createTokenOwnerRecordIx =
          await splGovernance.createTokenOwnerRecordInstruction(
            realmAddress,
            keypair.publicKey,
            councilMint,
            keypair.publicKey
          );

        // Deposit governing tokens instruction
        const depositGovTokenIx =
          await splGovernance.depositGoverningTokensInstruction(
            realmAddress,
            councilMint,
            councilMint, // source token mint = council mint (direct deposit)
            keypair.publicKey,
            keypair.publicKey,
            keypair.publicKey,
            1
          );

        // Execute instructions using MultisigService.executeInstructions
        const signature = await MultisigService.executeInstructions(
          connection,
          keypair,
          [createTokenOwnerRecordIx, depositGovTokenIx]
        );

        console.log(`Created token owner record with signature: ${signature}`);
        return tokenOwnerRecordPda.publicKey;
      }
    } catch (error) {
      console.error("Failed to get realm info:", error);
      throw error;
    }
  }

  /**
   * Creates a DAO proposal with the given instructions
   * Modified to use MultisigService.executeInstructions
   */
  static async createProposal(
    connection: Connection,
    keypair: Keypair,
    realmAddress: PublicKey,
    title: string,
    description: string,
    instructions: TransactionInstruction[]
  ): Promise<PublicKey> {
    const splGovernance = new SplGovernance(connection, this.programId);

    // First ensure the token owner record exists
    const tokenOwnerRecordKey = await this.ensureTokenOwnerRecord(
      connection,
      keypair,
      realmAddress
    );

    // Get the governance account for the realm
    const governanceId = splGovernance.pda.governanceAccount({
      realmAccount: realmAddress,
      seed: realmAddress,
    }).publicKey;

    console.log(`Creating proposal for governance: ${governanceId.toBase58()}`);

    // Get realm info to find the council mint
    const realmInfo = await splGovernance.getRealmByPubkey(realmAddress);
    const councilMint = realmInfo.config.councilMint;

    if (!councilMint) {
      throw new Error("Council mint not found for this realm");
    }

    const proposalSeed = Keypair.generate().publicKey;

    // Create proposal PDA address
    const proposalPda = splGovernance.pda.proposalAccount({
      governanceAccount: governanceId,
      governingTokenMint: councilMint,
      proposalSeed,
    });

    // Build create proposal instruction
    const createProposalIx = await splGovernance.createProposalInstruction(
      title,
      description,
      { choiceType: "single", multiChoiceOptions: null },
      ["Approve"],
      true, // use denial option
      realmAddress,
      governanceId,
      tokenOwnerRecordKey,
      councilMint,
      keypair.publicKey,
      keypair.publicKey,
      proposalSeed
    );

    // Add transaction instruction
    const insertIx = await splGovernance.insertTransactionInstruction(
      instructions,
      0, // option index
      0, // instruction index
      0, // hold up time
      governanceId,
      proposalPda.publicKey,
      tokenOwnerRecordKey,
      keypair.publicKey,
      keypair.publicKey
    );

    // Sign off on the proposal
    const signOffIx = await splGovernance.signOffProposalInstruction(
      realmAddress,
      governanceId,
      proposalPda.publicKey,
      keypair.publicKey,
      tokenOwnerRecordKey
    );

    // Execute instructions using MultisigService.executeInstructions
    const signature = await MultisigService.executeInstructions(
      connection,
      keypair,
      [createProposalIx, insertIx, signOffIx]
    );

    console.log(`Proposal created with signature: ${signature}`);
    console.log(`Proposal address: ${proposalPda.publicKey.toBase58()}`);

    return proposalPda.publicKey;
  }

  /**
   * Cast a vote on a proposal with automatic multisig execution when threshold is met
   * Modified to use MultisigService.executeInstructions
   */
  static async castVote(
    connection: Connection,
    keypair: Keypair,
    realmAddress: PublicKey,
    proposalAddress: PublicKey,
    approve: boolean
  ): Promise<string> {
    const splGovernance = new SplGovernance(connection, this.programId);

    // Get proposal info
    const proposal = await splGovernance.getProposalByPubkey(proposalAddress);

    // Extract multisig info from description if available
    const multisigInfo = this.extractMultisigInfo(proposal.descriptionLink);

    // Get governance account
    const governanceId = proposal.governance;

    // Get realm info to find the council mint
    const realmInfo = await splGovernance.getRealmByPubkey(realmAddress);
    const councilMint = realmInfo.config.councilMint;

    if (!councilMint) {
      throw new Error("Council mint not found for this realm");
    }

    // Get token owner record for the voter
    const tokenOwnerRecordPda = splGovernance.pda.tokenOwnerRecordAccount({
      realmAccount: realmAddress,
      governingTokenMintAccount: councilMint,
      governingTokenOwner: keypair.publicKey,
    });

    // Build vote instruction
    const voteIx = await splGovernance.castVoteInstruction(
      approve
        ? { approve: [[{ rank: 0, weightPercentage: 100 }]] }
        : { deny: {} },
      realmAddress,
      governanceId,
      proposalAddress,
      proposal.tokenOwnerRecord,
      tokenOwnerRecordPda.publicKey,
      keypair.publicKey,
      councilMint,
      keypair.publicKey
    );

    // Execute instructions using MultisigService.executeInstructions
    const signature = await MultisigService.executeInstructions(
      connection,
      keypair,
      [voteIx]
    );

    console.log(`DAO vote cast with signature: ${signature}`);

    // If this is an integrated proposal with multisig info and it's an approval,
    // we check if we should approve and possibly execute the multisig transaction
    if (
      multisigInfo.multisigAddress &&
      multisigInfo.transactionIndex &&
      approve
    ) {
      try {
        console.log(`\nThis is an integrated proposal with Squads multisig.`);

        // Use the approve and execute functionality from MultisigService
        const {
          approved,
          executed,
          signature: multisigSig,
        } = await MultisigService.approveAndExecuteIfReady(
          connection,
          keypair,
          multisigInfo.multisigAddress,
          multisigInfo.transactionIndex
        );

        if (approved && executed) {
          console.log(
            `✅ Multisig transaction automatically approved and executed with signature: ${multisigSig}`
          );
        } else if (approved) {
          console.log(
            `✅ Multisig transaction approved. More approvals needed before execution.`
          );
        } else {
          console.log(`❌ Failed to approve multisig transaction.`);
        }
      } catch (error) {
        console.error(`Failed to process multisig transaction:`, error);
        console.log(
          `Your DAO vote was recorded successfully, but there was an issue with the multisig transaction.`
        );
      }
    }

    return signature;
  }

  /**
   * Execute an approved proposal
   * Modified to use MultisigService.executeInstructions
   */
  static async executeProposal(
    connection: Connection,
    keypair: Keypair,
    proposalAddress: PublicKey
  ): Promise<string> {
    const splGovernance = new SplGovernance(connection, this.programId);

    // Get proposal info
    const proposal = await splGovernance.getProposalByPubkey(proposalAddress);

    // Extract multisig info from description if available
    const multisigInfo = this.extractMultisigInfo(proposal.descriptionLink);

    // Get governance account
    const governanceId = proposal.governance;

    // Get the proposal transaction account
    const proposalTxPda = splGovernance.pda.proposalTransactionAccount({
      proposal: proposalAddress,
      optionIndex: 0,
      index: 0,
    });

    // Get transaction details
    const proposalTx = await splGovernance.getProposalTransactionByPubkey(
      proposalTxPda.publicKey
    );

    // Get the native treasury to fix any isSigner flags
    const nativeTreasuryId = splGovernance.pda.nativeTreasuryAccount({
      governanceAccount: governanceId,
    }).publicKey;

    // Reconstruct accounts for execution
    const accountsForIx = proposalTx.instructions[0].accounts;

    // Add program ID as first account
    accountsForIx.unshift({
      pubkey: proposalTx.instructions[0].programId,
      isSigner: false,
      isWritable: false,
    });

    // Fix signer flags
    accountsForIx.forEach((account) => {
      if (account.pubkey.equals(nativeTreasuryId)) {
        account.isSigner = false;
      }

      // Also the keypair itself should be the only true signer
      if (!account.pubkey.equals(keypair.publicKey) && account.isSigner) {
        account.isSigner = false;
      }
    });

    // Build execution instruction
    const executeIx = await splGovernance.executeTransactionInstruction(
      governanceId,
      proposalAddress,
      proposalTxPda.publicKey,
      accountsForIx
    );

    // Execute instructions using MultisigService.executeInstructions
    const signature = await MultisigService.executeInstructions(
      connection,
      keypair,
      [executeIx]
    );

    console.log(`DAO proposal executed with signature: ${signature}`);
    
    // If this has created a multisig transaction, try to automatically approve and execute
    if (multisigInfo.multisigAddress && multisigInfo.transactionIndex) {
      try {
        // Add a delay to ensure the vault transaction is fully processed
        await new Promise((resolve) => setTimeout(resolve, 2000));

        console.log(
          `\nThis proposal has created a Squads multisig transaction!`
        );

        // Get proposal status using MultisigService
        const proposalStatus = await MultisigService.getProposalStatus(
          connection,
          multisigInfo.multisigAddress,
          multisigInfo.transactionIndex
        );

        console.log(
          `Automatically approving transaction #${multisigInfo.transactionIndex}...`
        );

        // Use the approve and execute functionality from MultisigService
        const {
          approved,
          executed,
          signature: multisigSig,
        } = await MultisigService.approveAndExecuteIfReady(
          connection,
          keypair,
          multisigInfo.multisigAddress,
          multisigInfo.transactionIndex
        );

        if (approved && executed) {
          console.log(
            `✅ Multisig transaction automatically approved and executed with signature: ${multisigSig}`
          );
        } else if (approved) {
          console.log(
            `✅ Multisig transaction approved, but more approvals are needed.`
          );
          console.log(
            `Current approvals: ${
              proposalStatus.approvalCount + 1
            }, threshold: ${proposalStatus.threshold}`
          );
          console.log(`You can manually execute later with:`);
          console.log(
            `dao multisig execute --multisig ${multisigInfo.multisigAddress.toString()} --index ${
              multisigInfo.transactionIndex
            }`
          );
        } else {
          console.log(`❌ Failed to approve multisig transaction.`);
        }
      } catch (error) {
        console.error(`Failed to process multisig transaction:`, error);
        console.log(
          `Your DAO proposal was executed successfully, but there was an issue with the multisig transaction.`
        );
      }
    }
    
    return signature;
  }

  /**
   * Extract multisig information from a proposal description
   */
  private static extractMultisigInfo(description: string): {
    multisigAddress?: PublicKey;
    transactionIndex?: number;
  } {
    try {
      // Check if this is an integrated proposal with multisig info
      if (!description.includes(this.MULTISIG_TAG)) {
        return {};
      }

      // Extract multisig address
      const addressLine = description
        .split("\n")
        .find((line) => line.startsWith(this.MULTISIG_ADDRESS_PREFIX));

      // Extract transaction index
      const indexLine = description
        .split("\n")
        .find((line) => line.startsWith(this.TX_INDEX_PREFIX));

      if (addressLine && indexLine) {
        const address = addressLine
          .substring(this.MULTISIG_ADDRESS_PREFIX.length)
          .trim();
        const index = indexLine.substring(this.TX_INDEX_PREFIX.length).trim();

        return {
          multisigAddress: new PublicKey(address),
          transactionIndex: parseInt(index),
        };
      }
    } catch (error) {
      console.log("Failed to extract multisig info from proposal description");
    }

    return {};
  }
}
