import { 
  Account,
  Contract,
  Provider,
  ProviderInterface,
  constants,
  stark,
  uint256,
  AccountInterface,
  ContractFactory,
  hash,
  validateAndParseAddress,
  CallData
} from 'starknet';
import { BigNumberish } from 'starknet/dist/utils/number';
import BN from 'bn.js';

// Enhanced type definitions
export interface DAOConfig {
  daoAddress: string;
  providerUrl?: string;
  deployerAccount?: AccountInterface;
  abis: {
    dao: any;
    token: any;
    pool: any;
  };
  network?: 'mainnet-alpha' | 'goerli-alpha' | 'localhost';
  maxRetries?: number;
  confirmations?: number;
}

export interface InitializeParams {
  manager: string;
  daoToken: string;
  fundraiseTarget: BigNumberish;
  minPoolPrice: BigNumberish;
  expiryTimestamp: number;
}

export interface PoolParams {
  ethAmount: BigNumberish;
  tokenAmount: BigNumberish;
  poolFactory: string;
}

export interface StakingInfo {
  amount: BigNumberish;
  rewardDebt: BigNumberish;
}

export interface DAOState {
  manager: string;
  treasury: string;
  daoToken: string;
  lpToken: string;
  dexPool: string;
  fundraiseTarget: BN;
  minPoolPrice: BN;
  expiryTimestamp: number;
  totalStaked: BN;
  rewardPerShare: BN;
  tradingFees: BN;
  stakingRewards: BN;
  managerFees: BN;
  isExpired: boolean;
  tradingActive: boolean;
}

export class DAOClient {
  private provider: ProviderInterface;
  private daoContract: Contract;
  private account?: AccountInterface;
  private readonly abis: DAOConfig['abis'];
  private readonly maxRetries: number;
  private readonly confirmations: number;

  constructor(config: DAOConfig) {
    // Validate configuration
    this.validateConfig(config);

    // Initialize provider with proper network
    this.provider = new Provider({
      sequencer: {
        network: config.network || constants.NetworkName.SN_GOERLI,
        baseUrl: config.providerUrl
      }
    });

    this.abis = config.abis;
    this.maxRetries = config.maxRetries || 3;
    this.confirmations = config.confirmations || 1;

    // Initialize DAO contract with validation
    try {
      validateAndParseAddress(config.daoAddress);
      this.daoContract = new Contract(
        this.abis.dao,
        config.daoAddress,
        this.provider
      );
    } catch (error) {
      throw new Error(`Invalid DAO address: ${error.message}`);
    }

    // Set deployer account if provided
    if (config.deployerAccount) {
      this.connect(config.deployerAccount);
    }
  }

  private validateConfig(config: DAOConfig): void {
    if (!config.daoAddress) {
      throw new Error('DAO address is required');
    }
    if (!config.abis.dao || !config.abis.token || !config.abis.pool) {
      throw new Error('All required ABIs must be provided');
    }
  }

  /**
   * Connect an account to the client
   */
  public connect(account: AccountInterface): void {
    this.account = account;
    this.daoContract.connect(account);
  }

  /**
   * Deploy new DAO contract with retry logic
   */
  async deployDAO(params: InitializeParams): Promise<string> {
    if (!this.account) {
      throw new Error('No account connected');
    }

    // Validate parameters
    this.validateAddress(params.manager, 'Manager');
    this.validateAddress(params.daoToken, 'DAO token');

    let attempt = 0;
    while (attempt < this.maxRetries) {
      try {
        const contractFactory = new ContractFactory({
          contract: this.abis.dao,
          account: this.account
        });

        const constructorCalldata = CallData.compile({
          manager: params.manager,
          dao_token: params.daoToken,
          fundraise_target: uint256.bnToUint256(params.fundraiseTarget),
          min_pool_price: uint256.bnToUint256(params.minPoolPrice),
          expiry_timestamp: params.expiryTimestamp
        });

        const deployResponse = await contractFactory.deploy({
          constructorCalldata
        });

        // Wait for deployment confirmation
        await this.waitForTransaction(deployResponse.transaction_hash);
        return deployResponse.contract_address;
      } catch (error) {
        attempt++;
        if (attempt === this.maxRetries) {
          throw new Error(`Failed to deploy DAO after ${this.maxRetries} attempts: ${error.message}`);
        }
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
    throw new Error('Deployment failed after maximum retries');
  }

  /**
   * Create liquidity pool with improved error handling
   */
  async createPool(params: PoolParams): Promise<string> {
    if (!this.account) {
      throw new Error('No account connected');
    }

    try {
      // Validate pool factory address
      this.validateAddress(params.poolFactory, 'Pool factory');

      // Get token contract with proper error handling
      const daoTokenAddress = await this.daoContract.dao_token();
      const daoToken = this.getTokenContract(daoTokenAddress);
      await daoToken.connect(this.account);

      // Approve tokens with proper amount validation
      const approveTx = await this.executeWithRetry(() =>
        daoToken.approve(
          params.poolFactory,
          uint256.bnToUint256(params.tokenAmount)
        )
      );
      await this.waitForTransaction(approveTx.transaction_hash);

      // Create pool
      const createPoolTx = await this.executeWithRetry(() =>
        this.daoContract.create_pool(
          uint256.bnToUint256(params.ethAmount),
          uint256.bnToUint256(params.tokenAmount),
          params.poolFactory
        )
      );

      await this.waitForTransaction(createPoolTx.transaction_hash);
      return createPoolTx.transaction_hash;
    } catch (error) {
      throw new Error(`Failed to create pool: ${error.message}`);
    }
  }

  /**
   * Stake LP tokens with improved validation
   */
  async stakeLPTokens(amount: BigNumberish): Promise<string> {
    if (!this.account) {
      throw new Error('No account connected');
    }

    try {
      // Get LP token contract
      const lpTokenAddress = await this.daoContract.lp_token();
      const lpToken = this.getTokenContract(lpTokenAddress);
      await lpToken.connect(this.account);

      // Validate balance
      const balance = await lpToken.balanceOf(this.account.address);
      if (uint256.uint256ToBN(balance).lt(new BN(amount.toString()))) {
        throw new Error('Insufficient LP token balance');
      }

      // Approve tokens
      const approveTx = await this.executeWithRetry(() =>
        lpToken.approve(
          this.daoContract.address,
          uint256.bnToUint256(amount)
        )
      );
      await this.waitForTransaction(approveTx.transaction_hash);

      // Stake tokens
      const stakeTx = await this.executeWithRetry(() =>
        this.daoContract.stake_lp(uint256.bnToUint256(amount))
      );

      await this.waitForTransaction(stakeTx.transaction_hash);
      return stakeTx.transaction_hash;
    } catch (error) {
      throw new Error(`Failed to stake LP tokens: ${error.message}`);
    }
  }

  /**
   * Unstake LP tokens with validation
   */
  async unstakeLPTokens(amount: BigNumberish): Promise<string> {
    if (!this.account) {
      throw new Error('No account connected');
    }

    try {
      // Validate staking balance
      const stakingInfo = await this.getStakingInfo(this.account.address);
      if (new BN(stakingInfo.amount.toString()).lt(new BN(amount.toString()))) {
        throw new Error('Insufficient staked balance');
      }

      const tx = await this.executeWithRetry(() =>
        this.daoContract.unstake_lp(uint256.bnToUint256(amount))
      );

      await this.waitForTransaction(tx.transaction_hash);
      return tx.transaction_hash;
    } catch (error) {
      throw new Error(`Failed to unstake LP tokens: ${error.message}`);
    }
  }

  /**
   * Helper method to get token contract instance
   */
  private getTokenContract(address: string): Contract {
    try {
      validateAndParseAddress(address);
      return new Contract(
        this.abis.token,
        address,
        this.provider
      );
    } catch (error) {
      throw new Error(`Invalid token address: ${error.message}`);
    }
  }

  /**
   * Helper method to execute with retry logic
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    retries: number = this.maxRetries
  ): Promise<T> {
    let lastError: Error;
    for (let i = 0; i < retries; i++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
        }
      }
    }
    throw lastError;
  }

  /**
   * Helper method to wait for transaction confirmation
   */
  private async waitForTransaction(hash: string): Promise<void> {
    try {
      await this.provider.waitForTransaction(hash, this.confirmations);
    } catch (error) {
      throw new Error(`Transaction failed: ${error.message}`);
    }
  }

  /**
   * Helper method to validate StarkNet address
   */
  private validateAddress(address: string, field: string): void {
    try {
      validateAndParseAddress(address);
    } catch (error) {
      throw new Error(`Invalid ${field} address: ${error.message}`);
    }
  }

  /**
   * Get staking information for an account
   */
  async getStakingInfo(account: string): Promise<StakingInfo> {
    try {
      this.validateAddress(account, 'Account');
      const info = await this.daoContract.staking_accounts(account);
      return {
        amount: uint256.uint256ToBN(info.amount),
        rewardDebt: uint256.uint256ToBN(info.reward_debt)
      };
    } catch (error) {
      throw new Error(`Failed to get staking info: ${error.message}`);
    }
  }

  /**
   * Get comprehensive DAO state
   */
  async getDAOState(): Promise<DAOState> {
    try {
      const [
        manager,
        treasury,
        daoToken,
        lpToken,
        dexPool,
        fundraiseTarget,
        minPoolPrice,
        expiryTimestamp,
        totalStaked,
        rewardPerShare,
        tradingFees,
        stakingRewards,
        managerFees,
        isExpired,
        tradingActive
      ] = await Promise.all([
        this.daoContract.manager(),
        this.daoContract.treasury(),
        this.daoContract.dao_token(),
        this.daoContract.lp_token(),
        this.daoContract.dex_pool(),
        this.daoContract.fundraise_target(),
        this.daoContract.min_pool_price(),
        this.daoContract.expiry_timestamp(),
        this.daoContract.total_staked(),
        this.daoContract.reward_per_share(),
        this.daoContract.trading_fees(),
        this.daoContract.staking_rewards(),
        this.daoContract.manager_fees(),
        this.daoContract.is_expired(),
        this.daoContract.trading_active()
      ]);

      return {
        manager,
        treasury,
        daoToken,
        lpToken,
        dexPool,
        fundraiseTarget: uint256.uint256ToBN(fundraiseTarget),
        minPoolPrice: uint256.uint256ToBN(minPoolPrice),
        expiryTimestamp,
        totalStaked: uint256.uint256ToBN(totalStaked),
        rewardPerShare: uint256.uint256ToBN(rewardPerShare),
        tradingFees: uint256.uint256ToBN(tradingFees),
        stakingRewards: uint256.uint256ToBN(stakingRewards),
        managerFees: uint256.uint256ToBN(managerFees),
        isExpired,
        tradingActive
      };
    } catch (error) {
      throw new Error(`Failed to get DAO state: ${error.message}`);
    }
  }
}
