#!/usr/bin/env node
import { program } from 'commander';
import { Provider, Account } from 'starknet';
import { Connection, Keypair } from '@solana/web3.js';
import ora from 'ora';
import chalk from 'chalk';
import jsonnet from '@jsonnet/jsonnet';
import fs from 'fs';
import { DAOClient as SolanaDAOClient } from './dao-client.js';
import { DAOClient as StarknetDAOClient } from './dao-starknet-client.ts';

// Chain-specific configurations
const SUPPORTED_CHAINS = ['solana', 'starknet'];
const DEFAULT_CHAIN = 'solana';

// Load and parse configuration
const loadDAOConfig = (chain) => {
  try {
    const configPath = process.env.DAO_CONFIG_PATH || `./dao-config-${chain}.jsonnet`;
    const configText = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(jsonnet.evaluateSnippet('config.jsonnet', configText));
  } catch (error) {
    console.error(chalk.red(`Error loading DAO config for ${chain}:`), error);
    process.exit(1);
  }
};

// Chain-specific client initialization
// Load contract ABIs
const loadContractABIs = () => {
  const abiPath = {
    solana: './abis/solana/',
    starknet: './abis/starknet/'
  };
  
  return {
    solana: {
      dao: JSON.parse(fs.readFileSync(`${abiPath.solana}dao.json`, 'utf8')),
      token: JSON.parse(fs.readFileSync(`${abiPath.solana}token.json`, 'utf8')),
      pool: JSON.parse(fs.readFileSync(`${abiPath.solana}pool.json`, 'utf8'))
    },
    starknet: {
      dao: JSON.parse(fs.readFileSync(`${abiPath.starknet}PartyDAO.json`, 'utf8')),
      token: JSON.parse(fs.readFileSync(`${abiPath.starknet}ERC20.json`, 'utf8')),
      pool: JSON.parse(fs.readFileSync(`${abiPath.starknet}JediPool.json`, 'utf8'))
    }
  };
};

const initializeClient = async (chain, config) => {
  const abis = loadContractABIs();
  
  switch (chain) {
    case 'solana': {
      const connection = new Connection(config.rpcUrl);
      return new SolanaDAOClient(connection, {
        ...config,
        programId: config.programs.dao,
        abis: abis.solana
      });
    }
    case 'starknet': {
      const provider = new Provider({ 
        sequencer: { network: config.providerUrl || 'mainnet-alpha' }
      });
      return new StarknetDAOClient({ 
        daoAddress: config.contracts.dao,
        providerUrl: config.providerUrl,
        deployerAccount: config.deployerAccount,
        abis: abis.starknet
      });
    }
    default:
      throw new Error(`Unsupported chain: ${chain}`);
  }
};

// Global options
program
  .version('2.0.0')
  .option('-c, --chain <chain>', 'blockchain to use (solana/starknet)', DEFAULT_CHAIN)
  .hook('preAction', (thisCommand) => {
    const chain = thisCommand.opts().chain.toLowerCase();
    if (!SUPPORTED_CHAINS.includes(chain)) {
      console.error(chalk.red(`Unsupported chain: ${chain}`));
      process.exit(1);
    }
  });

// Initialize DAO command
program
  .command('init')
  .description('Initialize new DAO')
  .requiredOption('-t, --target <amount>', 'Fundraising target in native token')
  .option('-d, --duration <days>', 'Fundraising duration in days', '7')
  .option('-m, --min-price <amount>', 'Minimum pool price in native token')
  .action(async (options) => {
    const chain = program.opts().chain;
    const config = loadDAOConfig(chain);
    const spinner = ora('Initializing DAO...').start();

    try {
      const client = await initializeClient(chain, config);
      const params = {
        fundraiseTarget: options.target,
        minPoolPrice: options.minPrice,
        expiryTimestamp: Date.now() + (parseInt(options.duration) * 24 * 60 * 60 * 1000)
      };

      if (chain === 'solana') {
        // Solana-specific initialization
        const daoMint = await client.createMint();
        params.daoToken = daoMint.publicKey.toString();
      }

      const result = await client.initializeDAO(params);
      
      spinner.succeed('DAO initialized successfully!');
      console.log(chalk.green(`Transaction Hash: ${result}`));
      
      // Save to config
      const localConfig = { ...config };
      if (chain === 'solana') {
        localConfig.daoMint = params.daoToken;
      }
      fs.writeFileSync(`./dao-config-${chain}.json`, JSON.stringify(localConfig, null, 2));
      
    } catch (error) {
      spinner.fail('Failed to initialize DAO');
      console.error(chalk.red('Error:'), error);
    }
  });

// Create pool command
program
  .command('create-pool')
  .description('Create liquidity pool')
  .requiredOption('-n, --native <amount>', 'Initial native token amount')
  .requiredOption('-t, --tokens <amount>', 'Initial DAO token amount')
  .action(async (options) => {
    const chain = program.opts().chain;
    const config = loadDAOConfig(chain);
    const spinner = ora('Creating liquidity pool...').start();

    try {
      const client = await initializeClient(chain, config);
      
      const poolParams = {
        nativeAmount: options.native,
        tokenAmount: options.tokens,
        ...(chain === 'starknet' ? { poolFactory: config.poolFactory } : {})
      };

      const result = await client.createPool(poolParams);
      
      spinner.succeed('Pool created successfully!');
      console.log(chalk.green(`Transaction Hash: ${result}`));
      
    } catch (error) {
      spinner.fail('Failed to create pool');
      console.error(chalk.red('Error:'), error);
    }
  });

// Stake LP tokens command
program
  .command('stake')
  .description('Stake LP tokens')
  .requiredOption('-a, --amount <amount>', 'Amount of LP tokens to stake')
  .action(async (options) => {
    const chain = program.opts().chain;
    const config = loadDAOConfig(chain);
    const spinner = ora('Staking LP tokens...').start();

    try {
      const client = await initializeClient(chain, config);
      const result = await client.stakeLPTokens(options.amount);
      
      spinner.succeed('Successfully staked LP tokens!');
      console.log(chalk.green(`Transaction Hash: ${result}`));
      
    } catch (error) {
      spinner.fail('Failed to stake LP tokens');
      console.error(chalk.red('Error:'), error);
    }
  });

// Unstake LP tokens command
program
  .command('unstake')
  .description('Unstake LP tokens')
  .requiredOption('-a, --amount <amount>', 'Amount of LP tokens to unstake')
  .action(async (options) => {
    const chain = program.opts().chain;
    const config = loadDAOConfig(chain);
    const spinner = ora('Unstaking LP tokens...').start();

    try {
      const client = await initializeClient(chain, config);
      const result = await client.unstakeLPTokens(options.amount);
      
      spinner.succeed('Successfully unstaked LP tokens!');
      console.log(chalk.green(`Transaction Hash: ${result}`));
      
    } catch (error) {
      spinner.fail('Failed to unstake LP tokens');
      console.error(chalk.red('Error:'), error);
    }
  });

// Get DAO state command
program
  .command('state')
  .description('Get current DAO state')
  .action(async () => {
    const chain = program.opts().chain;
    const config = loadDAOConfig(chain);
    const spinner = ora('Fetching DAO state...').start();

    try {
      const client = await initializeClient(chain, config);
      const state = await client.getDAOState();
      
      spinner.succeed('DAO state retrieved successfully!');
      console.log(chalk.cyan('Current DAO State:'));
      console.log(JSON.stringify(state, null, 2));
      
    } catch (error) {
      spinner.fail('Failed to fetch DAO state');
      console.error(chalk.red('Error:'), error);
    }
  });

// Collect fees command
program
  .command('collect-fees')
  .description('Collect accumulated fees')
  .action(async () => {
    const chain = program.opts().chain;
    const config = loadDAOConfig(chain);
    const spinner = ora('Collecting fees...').start();

    try {
      const client = await initializeClient(chain, config);
      const result = await client.collectFees();
      
      spinner.succeed('Successfully collected fees!');
      console.log(chalk.green(`Transaction Hash: ${result}`));
      
    } catch (error) {
      spinner.fail('Failed to collect fees');
      console.error(chalk.red('Error:'), error);
    }
  });

program.parse(process.argv);
