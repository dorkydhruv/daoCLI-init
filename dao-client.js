import { 
  Account, 
  Contract, 
  Provider, 
  ProviderInterface,
  constants,
  stark,
  uint256,
  AccountInterface,
  ContractFactory
} from 'starknet';
import { BigNumberish } from 'starknet/dist/utils/number';
import BN from 'bn.js';

// Types
interface DAOConfig {
  daoAddress: string;
  providerUrl?: string;
  deployerAccount?: AccountInterface;
  abis: {
    dao: any;
    token: any;
    pool: any;
  };
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
  private daoContract: Contract;
  private account?: AccountInterface;
  private abis: DAOConfig['abis'];

  constructor(config: DAOConfig) {
    // Initialize provider
    this.provider = new Provider({
      sequencer: {
        network: config.providerUrl || constants.NetworkName.SN_GOERLI
      }
    });

    this.abis = config.abis;

    // Initialize DAO contract
    this.daoContract = new Contract(
      this.abis.dao,
      config.daoAddress,
      this.provider
    );

    // Set deployer account if provided
    if (config.deployerAccount) {
      this.account = config.deployerAccount;
      this.daoContract.connect(this.account);
    }
  }

  async deployDAO(params: InitializeParams): Promise<string> {
    if (!this.account) {
      throw new Error('No account connected');
    }

    try {
      // Deploy new DAO contract
      const contractFactory = new ContractFactory({
        contract: this.abis.dao,
        account: this.account
      });

      const deployResponse = await contractFactory.deploy({
        constructorCalldata: [
          params.manager,
          params.daoToken,
          uint256.bnToUint256(params.fundraiseTarget),
          uint256.bnToUint256(params.minPoolPrice),
          params.expiryTimestamp
        ]
      });

      await this.provider.waitForTransaction(deployResponse.transaction_hash);
      return deployResponse.contract_address;
    } catch (error) {
      console.error('Failed to deploy DAO:', error);
      throw error;
    }
  }

  /**
   * Create liquidity pool
   */
  async createPool(params: PoolParams): Promise<string> {
    if (!this.account) {
      throw new Error('No account connected');
    }

    try {
      // Get token contract
      const daoTokenAddress = await this.daoContract.dao_token();
      const daoToken = new Contract(
        this.abis.token,
        daoTokenAddress,
        this.provider
      );
      
      await daoToken.connect(this.account);

      // Approve tokens for pool
      const approveTx = await daoToken.approve(
        params.poolFactory,
        uint256.bnToUint256(params.tokenAmount)
      );
      await this.provider.waitForTransaction(approveTx.transaction_hash);

      // Create pool
      const tx = await this.daoContract.create_pool(
        uint256.bnToUint256(params.ethAmount),
        uint256.bnToUint256(params.tokenAmount),
        params.poolFactory
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
   */
  async stakeLPTokens(amount: BigNumberish): Promise<string> {
    if (!this.account) {
      throw new Error('No account connected');
    }

    try {
      // Get LP token contract
      const lpTokenAddress = await this.daoContract.lp_token();
      const lpToken = new Contract(
        this.abis.token,  // Using ERC20 ABI
        lpTokenAddress,
        this.provider
      );
      
      await lpToken.connect(this.account);

      // Approve LP tokens
      const approveTx = await lpToken.approve(
        this.daoContract.address,
        uint256.bnToUint256(amount)
      );
      await this.provider.waitForTransaction(approveTx.transaction_hash);

      // Stake tokens
      const tx = await this.daoContract.stake_lp(
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
   */
  async unstakeLPTokens(amount: BigNumberish): Promise<string> {
    if (!this.account) {
      throw new Error('No account connected');
    }

    try {
      const tx = await this.daoContract.unstake_lp(
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
   */
  async collectFees(): Promise<string> {
    if (!this.account) {
      throw new Error('No account connected');
    }

    try {
      const tx = await this.daoContract.collect_fees();
      await this.provider.waitForTransaction(tx.transaction_hash);
      return tx.transaction_hash;
    } catch (error) {
      console.error('Failed to collect fees:', error);
      throw error;
    }
  }

  /**
   * Get staking information for an account
   */
  async getStakingInfo(account: string): Promise<StakingInfo> {
    try {
      const info = await this.daoContract.staking_accounts(account);
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
      console.error('Failed to get DAO state:', error);
      throw error;
    }
  }

  /**
   * Connect an account to the client
   */
  connect(account: AccountInterface) {
    this.account = account;
    this.daoContract.connect(account);
  }
}
