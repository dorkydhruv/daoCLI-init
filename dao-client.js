import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
  TransactionInstruction,
  Signer
} from '@solana/web3.js';
import {
  Program,
  AnchorProvider,
  web3,
  BN,
  Address
} from '@project-serum/anchor';
import { 
  Token,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID 
} from '@solana/spl-token';

// Type definitions
export interface DAOConfig {
  programId: string;
  connection: Connection;
  wallet?: Signer;
  opts?: ConfirmOptions;
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
  private wallet?: Signer;
  private programId: PublicKey;

  constructor(config: DAOConfig) {
    this.connection = config.connection;
    this.wallet = config.wallet;
    this.programId = new PublicKey(config.programId);
    
    // Initialize Anchor provider and program
    const provider = new AnchorProvider(
      this.connection,
      this.wallet as any,
      config.opts || { commitment: 'confirmed' }
    );
    
    // Load the program
    this.program = new Program(config.idl, this.programId, provider);
  }

  /**
   * Initialize a new DAO
   */
  async initializeDAO(params: InitializeParams): Promise<string> {
    try {
      if (!this.wallet) throw new Error('No wallet connected');

      // Derive PDA for treasury
      const [treasury] = await PublicKey.findProgramAddress(
        [Buffer.from('treasury'), this.wallet.publicKey.toBuffer()],
        this.programId
      );

      // Create initialization instruction
      const tx = await this.program.methods
        .initialize(
          params.fundraiseTarget,
          params.minPoolPrice,
          params.expiryTimestamp
        )
        .accounts({
          daoState: await this.getDaoStatePDA(params.manager),
          treasury,
          manager: params.manager,
          daoToken: params.daoToken,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: web3.SYSVAR_RENT_PUBKEY
        })
        .rpc();

      await this.connection.confirmTransaction(tx, 'confirmed');
      return tx;
    } catch (error) {
      console.error('Failed to initialize DAO:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Create liquidity pool
   */
  async createPool(params: PoolParams): Promise<string> {
    try {
      if (!this.wallet) throw new Error('No wallet connected');

      // Get DAO state account
      const daoState = await this.getDaoStatePDA(this.wallet.publicKey);
      const daoStateInfo = await this.program.account.daoState.fetch(daoState);

      // Create pool instruction
      const tx = await this.program.methods
        .createPool(
          params.solAmount,
          params.tokenAmount
        )
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
    } catch (error) {
      console.error('Failed to create pool:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Stake LP tokens
   */
  async stakeLPTokens(amount: BN): Promise<string> {
    try {
      if (!this.wallet) throw new Error('No wallet connected');

      // Get required PDAs and accounts
      const daoState = await this.getDaoStatePDA(this.wallet.publicKey);
      const daoStateInfo = await this.program.account.daoState.fetch(daoState);
      const userLpAccount = await this.findAssociatedTokenAccount(
        this.wallet.publicKey,
        daoStateInfo.lpToken
      );
      const poolLpAccount = await this.findAssociatedTokenAccount(
        daoState,
        daoStateInfo.lpToken
      );

      // Create staking instruction
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
          rent: web3.SYSVAR_RENT_PUBKEY
        })
        .rpc();

      await this.connection.confirmTransaction(tx, 'confirmed');
      return tx;
    } catch (error) {
      console.error('Failed to stake LP tokens:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Unstake LP tokens
   */
  async unstakeLPTokens(amount: BN): Promise<string> {
    try {
      if (!this.wallet) throw new Error('No wallet connected');

      // Get required PDAs and accounts
      const daoState = await this.getDaoStatePDA(this.wallet.publicKey);
      const daoStateInfo = await this.program.account.daoState.fetch(daoState);
      const [treasury] = await PublicKey.findProgramAddress(
        [Buffer.from('treasury'), daoState.toBuffer()],
        this.programId
      );

      const userLpAccount = await this.findAssociatedTokenAccount(
        this.wallet.publicKey,
        daoStateInfo.lpToken
      );
      const poolLpAccount = await this.findAssociatedTokenAccount(
        daoState,
        daoStateInfo.lpToken
      );
      const userRewardAccount = await this.findAssociatedTokenAccount(
        this.wallet.publicKey,
        daoStateInfo.daoToken
      );
      const rewardVault = await this.findAssociatedTokenAccount(
        treasury,
        daoStateInfo.daoToken
      );

      // Create unstaking instruction
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
          tokenProgram: TOKEN_PROGRAM_ID
        })
        .rpc();

      await this.connection.confirmTransaction(tx, 'confirmed');
      return tx;
    } catch (error) {
      console.error('Failed to unstake LP tokens:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Collect accumulated fees
   */
  async collectFees(): Promise<string> {
    try {
      if (!this.wallet) throw new Error('No wallet connected');

      const daoState = await this.getDaoStatePDA(this.wallet.publicKey);
      const daoStateInfo = await this.program.account.daoState.fetch(daoState);
      const [treasury] = await PublicKey.findProgramAddress(
        [Buffer.from('treasury'), daoState.toBuffer()],
        this.programId
      );

      const managerTokenAccount = await this.findAssociatedTokenAccount(
        this.wallet.publicKey,
        daoStateInfo.daoToken
      );
      const feeVault = await this.findAssociatedTokenAccount(
        treasury,
        daoStateInfo.daoToken
      );

      const tx = await this.program.methods
        .collectFees()
        .accounts({
          daoState,
          manager: this.wallet.publicKey,
          feeVault,
          managerToken: managerTokenAccount,
          treasury,
          tokenProgram: TOKEN_PROGRAM_ID
        })
        .rpc();

      await this.connection.confirmTransaction(tx, 'confirmed');
      return tx;
    } catch (error) {
      console.error('Failed to collect fees:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get staking information for an account
   */
  async getStakingInfo(account: PublicKey): Promise<StakingInfo> {
    try {
      const stakingAccount = await this.getStakingAccountPDA(account);
      const info = await this.program.account.stakingAccount.fetch(stakingAccount);
      return {
        amount: info.amount,
        rewardDebt: info.rewardDebt
      };
    } catch (error) {
      console.error('Failed to get staking info:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get current DAO state
   */
  async getDAOState(manager: PublicKey): Promise<DAOState> {
    try {
      const daoState = await this.getDaoStatePDA(manager);
      const state = await this.program.account.daoState.fetch(daoState);
      return {
        manager: state.manager,
        treasury: state.treasury,
        daoToken: state.daoToken,
        lpToken: state.lpToken,
        dexPool: state.dexPool,
        fundraiseTarget: state.fundraiseTarget,
        minPoolPrice: state.minPoolPrice,
        expiryTimestamp: state.expiryTimestamp,
        totalStaked: state.totalStaked,
        rewardPerShare: state.rewardPerShare,
        tradingFees: state.tradingFees,
        stakingRewards: state.stakingRewards,
        managerFees: state.managerFees,
        isExpired: state.isExpired,
        tradingActive: state.tradingActive
      };
    } catch (error) {
      console.error('Failed to get DAO state:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Helper method to find associated token account
   */
  private async findAssociatedTokenAccount(
    owner: PublicKey,
    mint: PublicKey
  ): Promise<PublicKey> {
    return Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      mint,
      owner
    );
  }

  /**
   * Helper method to derive DAO state PDA
   */
  private async getDaoStatePDA(manager: PublicKey): Promise<PublicKey> {
    const [pda] = await PublicKey.findProgramAddress(
      [Buffer.from('dao_state'), manager.toBuffer()],
      this.programId
    );
    return pda;
  }

  /**
   * Helper method to derive staking account PDA
   */
  private async getStakingAccountPDA(user: PublicKey): Promise<PublicKey> {
    const [pda] = await PublicKey.findProgramAddress(
      [Buffer.from('staking'), user.toBuffer()],
      this.programId
    );
    return pda;
  }

  /**
   * Error handler
   */
  private handleError(error: any): Error {
    if (error.code) {
      // Handle program specific errors
      switch (error.code) {
        case 6000:
          return new Error('Unauthorized access');
        case 6001:
          return new Error('Insufficient stake');
        case 6002:
          return new Error('Pool not active');
        default:
          return error;
      }
    }
    return error;
  }

  /**
   * Connect wallet to client
   */
  connect(wallet: Signer) {
    this.wallet = wallet;
    const provider = new AnchorProvider(
      this.connection,
      wallet as any,
      { commitment: 'confirmed' }
    );
    this.program = new Program(this.program.idl, this.programId, provider);
  }
}
