import {
  Connection,
  PublicKey,
  SystemProgram,
  ConfirmOptions,
} from '@solana/web3.js';
import { Program, AnchorProvider, web3, BN } from '@project-serum/anchor';
import { Token, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';

// Type definitions for configuration and parameters:
export interface DAOConfig {
  programId: string;
  connection: Connection;
  wallet?: any; // Signer type
  opts?: ConfirmOptions;
  idl: any;
}

export interface InitializeParams {
  manager: PublicKey;
  daoToken: PublicKey;
  fundraiseTarget: BN;
  minPoolPrice: BN;
  expiryTimestamp: BN;
}

export interface PoolParams {
  solAmount: BN;
  tokenAmount: BN;
  dexProgram: PublicKey;
}

export interface StakingInfo {
  amount: BN;
  rewardDebt: BN;
}

export interface DAOState {
  manager: PublicKey;
  treasury: PublicKey;
  daoToken: PublicKey;
  lpToken: PublicKey;
  dexPool: PublicKey;
  fundraiseTarget: BN;
  minPoolPrice: BN;
  expiryTimestamp: BN;
  totalStaked: BN;
  rewardPerShare: BN;
  tradingFees: BN;
  stakingRewards: BN;
  managerFees: BN;
  isExpired: boolean;
  tradingActive: boolean;
}

export class SolanaDAOClient {
  private connection: Connection;
  private program: Program;
  private wallet: any;
  private programId: PublicKey;

  constructor(config: DAOConfig) {
    this.connection = config.connection;
    this.wallet = config.wallet;
    this.programId = new PublicKey(config.programId);
    const provider = new AnchorProvider(
      this.connection,
      this.wallet,
      config.opts || { commitment: 'confirmed' }
    );
    this.program = new Program(config.idl, this.programId, provider);
  }

  // Initialize the DAO
  async initializeDAO(params: InitializeParams): Promise<string> {
    if (!this.wallet) throw new Error('No wallet connected');

    const [treasury] = await PublicKey.findProgramAddress(
      [Buffer.from('treasury'), this.wallet.publicKey.toBuffer()],
      this.programId
    );
    const daoState = await this.getDaoStatePDA(params.manager);
    const tx = await this.program.methods
      .initialize(
        params.fundraiseTarget,
        params.minPoolPrice,
        params.expiryTimestamp
      )
      .accounts({
        daoState,
        treasury,
        manager: params.manager,
        daoToken: params.daoToken,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();
    await this.connection.confirmTransaction(tx, 'confirmed');
    return tx;
  }

  // Create a liquidity pool
  async createPool(params: PoolParams): Promise<string> {
    const daoState = await this.getDaoStatePDA(this.wallet.publicKey);
    const tx = await this.program.methods
      .createPool(params.solAmount, params.tokenAmount)
      .accounts({
        daoState,
        manager: this.wallet.publicKey,
        dexProgram: params.dexProgram,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
    await this.connection.confirmTransaction(tx, 'confirmed');
    return tx;
  }

  // Stake LP tokens
  async stakeLPTokens(amount: BN): Promise<string> {
    const daoState = await this.getDaoStatePDA(this.wallet.publicKey);
    const daoStateInfo = await this.program.account.daoState.fetch(daoState);
    const userLpAccount = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      daoStateInfo.lpToken,
      this.wallet.publicKey
    );
    const poolLpAccount = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      daoStateInfo.lpToken,
      daoState
    );
    const tx = await this.program.methods
      .stakeLp(amount)
      .accounts({
        daoState,
        stakingAccount: await this.getStakingAccountPDA(this.wallet.publicKey),
        user: this.wallet.publicKey,
        userLp: userLpAccount,
        poolLp: poolLpAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();
    await this.connection.confirmTransaction(tx, 'confirmed');
    return tx;
  }

  // Unstake LP tokens and claim rewards
  async unstakeLPTokens(amount: BN): Promise<string> {
    const daoState = await this.getDaoStatePDA(this.wallet.publicKey);
    const daoStateInfo = await this.program.account.daoState.fetch(daoState);
    const [treasury] = await PublicKey.findProgramAddress(
      [Buffer.from('treasury'), daoState.toBuffer()],
      this.programId
    );
    const userLpAccount = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      daoStateInfo.lpToken,
      this.wallet.publicKey
    );
    const poolLpAccount = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      daoStateInfo.lpToken,
      daoState
    );
    const userRewardAccount = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      daoStateInfo.daoToken,
      this.wallet.publicKey
    );
    const rewardVault = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      daoStateInfo.daoToken,
      treasury
    );
    const tx = await this.program.methods
      .unstakeLp(amount)
      .accounts({
        daoState,
        stakingAccount: await this.getStakingAccountPDA(this.wallet.publicKey),
        user: this.wallet.publicKey,
        userLp: userLpAccount,
        poolLp: poolLpAccount,
        rewardVault,
        userReward: userRewardAccount,
        treasury,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
    await this.connection.confirmTransaction(tx, 'confirmed');
    return tx;
  }

  // Collect accumulated fees
  async collectFees(): Promise<string> {
    const daoState = await this.getDaoStatePDA(this.wallet.publicKey);
    const daoStateInfo = await this.program.account.daoState.fetch(daoState);
    const [treasury] = await PublicKey.findProgramAddress(
      [Buffer.from('treasury'), daoState.toBuffer()],
      this.programId
    );
    const managerTokenAccount = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      daoStateInfo.daoToken,
      this.wallet.publicKey
    );
    const feeVault = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      daoStateInfo.daoToken,
      treasury
    );
    const tx = await this.program.methods
      .collectFees()
      .accounts({
        daoState,
        manager: this.wallet.publicKey,
        feeVault,
        managerToken: managerTokenAccount,
        treasury,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
    await this.connection.confirmTransaction(tx, 'confirmed');
    return tx;
  }

  // Helpers to derive PDAs
  private async getDaoStatePDA(manager: PublicKey): Promise<PublicKey> {
    const [pda] = await PublicKey.findProgramAddress(
      [Buffer.from('dao_state'), manager.toBuffer()],
      this.programId
    );
    return pda;
  }

  private async getStakingAccountPDA(user: PublicKey): Promise<PublicKey> {
    const [pda] = await PublicKey.findProgramAddress(
      [Buffer.from('staking'), user.toBuffer()],
      this.programId
    );
    return pda;
  }

  // Allow wallet connection to be updated later.
  connect(wallet: any) {
    this.wallet = wallet;
    const provider = new AnchorProvider(
      this.connection,
      wallet,
      { commitment: 'confirmed' }
    );
    this.program = new Program(this.program.idl, this.programId, provider);
  }
}
