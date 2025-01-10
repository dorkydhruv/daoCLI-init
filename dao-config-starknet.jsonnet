
// dao-config-starknet.jsonnet
{
  // Network Configuration
  network: 'mainnet-alpha',  // or 'goerli-alpha', 'testnet'
  providerUrl: 'https://starknet-mainnet.infura.io/v3/YOUR-PROJECT-ID',
  chainId: 'SN_MAIN',

  // Contract Addresses
  contracts: {
    dao: '0x123...abc',  // Your deployed DAO contract
    poolFactory: '0x456...def',  // JediSwap factory
    router: '0x789...ghi',      // JediSwap router
  },

  // Fee Configuration
  fees: {
    tradingFee: 0.003,    // 0.3%
    stakingFee: 0.002,    // 0.2%
    managerFee: 0.08,     // 8%
    minFeeAmount: '1000', // in wei
  },

  // Pool Configuration
  pool: {
    defaultSlippage: 0.005,  // 0.5%
    maxSlippage: 0.02,       // 2%
    feeTier: 'FEE_TIER_MEDIUM', // JediSwap 0.3% tier
    minLiquidity: '1000000', // Minimum liquidity requirement
  },

  // Treasury Configuration
  treasury: {
    minReserve: '1000000000000000000',  // 1 ETH in wei
    rebalanceThreshold: 0.1,            // 10%
    maxTradeSize: '100000000000000000000', // 100 ETH in wei
  },

  // Staking Configuration
  staking: {
    minStakePeriod: 86400,    // 1 day in seconds
    maxBoostMultiplier: 2.5,
    rewardRate: '100000000',  // Base reward rate per block
  },

  // Cairo Contract Specific
  cairo: {
    maxFeePerGas: '100000000000',
    maxPriorityFeePerGas: '100000000000',
    customErrors: true,
    deployerAddress: '0x...', // Optional deployer address
  },

  // Gas Configuration
  gas: {
    estimateMultiplier: 1.2,
    maxGasPrice: '1000000000000', // in wei
  },

  // Governance Configuration
  governance: {
    quorum: 0.1,           // 10%
    executionDelay: 86400, // 1 day
    votingPeriod: 259200,  // 3 days
    proposalThreshold: '1000000000000000000000', // 1000 tokens
  },

  // Account Integration
  account: {
    implementation: '0x123...', // Account contract implementation
    multicallAddress: '0x456...', // Multicall contract address
  },

  // Development & Debug
  debug: false,
  logLevel: 'info',
  
  // Custom Validation Rules
  validation: {
    maxTokenAmount: '1000000000000000000000000', // 1M tokens
    minTokenAmount: '1000000000000000000',       // 1 token
    maxEthAmount: '1000000000000000000000',      // 1000 ETH
    minEthAmount: '1000000000000000000',         // 1 ETH
  },
}
