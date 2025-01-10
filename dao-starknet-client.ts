import { 
  Account, 
  Contract, 
  Provider, 
  ProviderInterface,
  constants,
  stark,
  uint256,
  AccountInterface
} from 'starknet';
import { BigNumberish } from 'starknet/dist/utils/number';
import BN from 'bn.js';

// Types
interface DAOConfig {
  daoAddress: string;
  providerUrl?: string;
  deployerAccount?: AccountInterface;
}

interface InitializeParams {
  manager: string;
  daoToken: string;
  fundraiseTarget: BigNumberish;
  minPoolPrice: BigNumberish;
  expiryTimestamp: number;
}

interface PoolParams {
  ethAmount: BigNumberish;
  tokenAmount: BigNumberish;
  poolFactory: string;
}

interface StakingInfo {
  amount: BigNumberish;
  rewardDebt: BigNumberish;
}

export class DAOClient {
  private provider: ProviderInterface;
  private contract: Contract;
  private account?: AccountInterface;

  constructor(config: DAOConfig) {
    // Initialize provider
    this.provider = new Provider({
      sequencer: {
        network: config.providerUrl || constants.NetworkName.SN_GOERLI
      }
    });

    // Initialize contract
    this.contract = new Contract(
      require('./abis/PartyDAO.json'),
      config.daoAddress,
      this.provider
    );

    // Set deployer account if provided
    if (config.deployerAccount) {
      this.account = config.deployerAccount;
      this.contract.connect(this.account);
    }
  }

  /**
   * Initialize a new DAO
   * @param params Initialize parameters
   * @returns Transaction hash
   */
  async initializeDAO(params: InitializeParams): Promise<string> {
    if (!this.account) {
      throw new Error('No account connected');
    }

    const {
      manager,
      daoToken,
      fundraiseTarget,
      minPoolPrice,
      expiryTimestamp
    } = params;

    try {
      const tx = await this.contract.constructor(
        manager,
        daoToken,
        uint256.bnToUint256(fundraiseTarget),
        uint256.bnToUint256(minPoolPrice),
        expiryTimestamp
      );

      await this.provider.waitForTransaction(tx.transaction_hash);
      return tx.transaction_hash;
    } catch (error) {
      console.error('Failed to initialize DAO:', error);
      throw error;
    }
  }

  /**
   * Create liquidity pool
   * @param params Pool creation parameters
   * @returns Transaction hash
   */
  async createPool(params: PoolParams): Promise<string> {
    if (!this.account) {
      throw new Error('No account connected');
    }

    const { ethAmount, tokenAmount, poolFactory } = params;

    try {
      // First approve tokens to the pool
      const daoTokenAddress = await this.contract.dao_token();
      const daoToken = new Contract(
        require('./abis/ERC20.json'),
        daoTokenAddress,
        this.provider
      );
      
      await daoToken.connect(this.account);
      const approveTx = await daoToken.approve(
        poolFactory,
        uint256.bnToUint256(tokenAmount)
      );
      await this.provider.waitForTransaction(approveTx.transaction_hash);

      // Create pool
      const tx = await this.contract.create_pool(
        uint256.bnToUint256(ethAmount),
        uint256.bnToUint256(tokenAmount),
        poolFactory
      );

      await this.provider.waitForTransaction(tx.transaction_hash);
      return tx.transaction_hash;
    } catch (error) {
      console.error('Failed to create pool:', error);
      throw error;
    }
  }

  /**
   * Stake LP tokens
   * @param amount Amount of LP tokens to stake
   * @returns Transaction hash
   */
  async stakeLPTokens(amount: BigNumberish): Promise<string> {
    if (!this.account) {
      throw new Error('No account connected');
    }

    try {
      // First approve LP tokens
      const lpTokenAddress = await this.contract.lp_token();
      const lpToken = new Contract(
        require('./abis/ERC20.json'),
        lpTokenAddress,
        this.provider
      );
      
      await lpToken.connect(this.account);
      const approveTx = await lpToken.approve(
        this.contract.address,
        uint256.bnToUint256(amount)
      );
      await this.provider.waitForTransaction(approveTx.transaction_hash);

      // Stake tokens
      const tx = await this.contract.stake_lp(
        uint256.bnToUint256(amount)
      );

      await this.provider.waitForTransaction(tx.transaction_hash);
      return tx.transaction_hash;
    } catch (error) {
      console.error('Failed to stake LP tokens:', error);
      throw error;
    }
  }

  /**
   * Unstake LP tokens
   * @param amount Amount of LP tokens to unstake
   * @returns Transaction hash
   */
  async unstakeLPTokens(amount: BigNumberish): Promise<string> {
    if (!this.account) {
      throw new Error('No account connected');
    }

    try {
      const tx = await this.contract.unstake_lp(
        uint256.bnToUint256(amount)
      );

      await this.provider.waitForTransaction(tx.transaction_hash);
      return tx.transaction_hash;
    } catch (error) {
      console.error('Failed to unstake LP tokens:', error);
      throw error;
    }
  }

  /**
   * Collect accumulated fees
   * @returns Transaction hash
   */
  async collectFees(): Promise<string> {
    if (!this.account) {
      throw new Error('No account connected');
    }

    try {
      const tx = await this.contract.collect_fees();
      await this.provider.waitForTransaction(tx.transaction_hash);
      return tx.transaction_hash;
    } catch (error) {
      console.error('Failed to collect fees:', error);
      throw error;
    }
  }

  /**
   * Get staking information for an account
   * @param account Account address
   * @returns Staking information
   */
  async getStakingInfo(account: string): Promise<StakingInfo> {
    try {
      const info = await this.contract.staking_accounts(account);
      return {
        amount: uint256.uint256ToBN(info.amount),
        rewardDebt: uint256.uint256ToBN(info.reward_debt)
      };
    } catch (error) {
      console.error('Failed to get staking info:', error);
      throw error;
    }
  }

  /**
   * Get DAO state
   */
  async getDAOState() {
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
        this.contract.manager(),
        this.contract.treasury(),
        this.contract.dao_token(),
        this.contract.lp_token(),
        this.contract.dex_pool(),
        this.contract.fundraise_target(),
        this.contract.min_pool_price(),
        this.contract.expiry_timestamp(),
        this.contract.total_staked(),
        this.contract.reward_per_share(),
        this.contract.trading_fees(),
        this.contract.staking_rewards(),
        this.contract.manager_fees(),
        this.contract.is_expired(),
        this.contract.trading_active()
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
      console.error('Failed to get DAO state:', error);
      throw error;
    }
  }

  /**
   * Connect an account to the client
   * @param account Account to connect
   */
  connect(account: AccountInterface) {
    this.account = account;
    this.contract.connect(account);
  }
}

// Helper functions for CLI
export const initializeDAO = async (
  client: DAOClient,
  options: InitializeParams
): Promise<string> => {
  return client.initializeDAO(options);
};

export const createPool = async (
  client: DAOClient,
  options: PoolParams
): Promise<string> => {
  return client.createPool(options);
};

export const stakeLPTokens = async (
  client: DAOClient,
  amount: BigNumberish
): Promise<string> => {
  return client.stakeLPTokens(amount);
};

export const unstakeLPTokens = async (
  client: DAOClient,
  amount: BigNumberish
): Promise<string> => {
  return client.unstakeLPTokens(amount);
};