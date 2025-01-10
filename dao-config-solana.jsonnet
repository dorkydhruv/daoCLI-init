{
  // Network Configuration
  network: 'mainnet-beta',  // or 'devnet', 'testnet'
  rpcUrl: 'https://api.mainnet-beta.solana.com',
  wsUrl: 'wss://api.mainnet-beta.solana.com',
  
  // Program IDs
  programs: {
    dao: 'dao11111111111111111111111111111111111111',
    token: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
    amm: {
      orca: 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',
      raydium: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
    }
  },

  // Fee Configuration
  fees: {
    tradingFee: 0.003,  // 0.3%
    stakingFee: 0.002,  // 0.2%
    managerFee: 0.08,   // 8%
    minimum: 0.000001,  // Minimum fee in SOL
  },

  // Pool Configuration
  pool: {
    defaultSlippage: 0.005,  // 0.5%
    maxSlippage: 0.02,       // 2%
    tickSpacing: 64,
    feeTier: 'medium',       // Corresponds to 0.3%
  },

  // Treasury Configuration
  treasury: {
    minReserve: 1,           // SOL
    rebalanceThreshold: 0.1, // 10%
    maxTradeSize: 100,       // SOL
  },

  // Staking Configuration
  staking: {
    minStakePeriod: 86400,   // 1 day in seconds
    maxBoostMultiplier: 2.5,
    rewardRate: 0.1,         // 10% base APR
  },

  // Governance Configuration
  governance: {
    quorum: 0.1,             // 10%
    executionDelay: 86400,   // 1 day
    votingPeriod: 259200,    // 3 days
  },

  // Development & Debug
  debug: false,
  logLevel: 'info',
}
