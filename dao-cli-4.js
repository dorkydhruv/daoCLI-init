#!/usr/bin/env node
// Previous imports remain the same, adding these new ones:
import jsonnet from '@jsonnet/jsonnet';
import {
  WhirlpoolContext,
  buildWhirlpoolClient,
  ORCA_WHIRLPOOL_PROGRAM_ID,
  PDAUtil,
  PoolUtil,
  PriceMath
} from '@orca-so/whirlpools-sdk';
import { Percentage } from '@orca-so/common-sdk';
import { struct, u8, u16, u64, i64, bool } from '@coral-xyz/borsh';

// Load and parse configuration
const loadDAOConfig = () => {
  try {
    const configPath = process.env.DAO_CONFIG_PATH || './dao-config.jsonnet';
    const configText = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(jsonnet.evaluateSnippet('config.jsonnet', configText));
  } catch (error) {
    console.error(chalk.red('Error loading DAO config:'), error);
    process.exit(1);
  }
};

const config = loadDAOConfig();

// Instruction layout builders based on config
const createInstructionLayout = (layout) => {
  const fields = layout.map(({ name, type }) => [name, type === 'u64' ? u64() : type === 'i64' ? i64() : type === 'u16' ? u16() : type === 'u8' ? u8() : bool()]);
  return struct(fields);
};

const layouts = {
  initialize: createInstructionLayout(config.instructions.initialize.layout),
  createPool: createInstructionLayout(config.instructions.createPool.layout),
  stake: createInstructionLayout(config.instructions.stake.layout),
};

// Initialize DAO with proper instruction
program
  .command('init')
  .description('Initialize new DAO')
  .requiredOption('-t, --target <sol>', 'Fundraising target in SOL')
  .option('-d, --duration <days>', 'Fundraising duration in days', '7')
  .option('-m, --min-price <sol>', 'Minimum pool price in SOL')
  .action(async (options) => {
    const spinner = ora('Initializing DAO...').start();
    try {
      const provider = getAnchorProvider();
      const fundraiseTarget = new BN(options.target).mul(new BN(1e9));
      const minPrice = new BN(options.minPrice).mul(new BN(1e9));
      const expiryDate = new BN(Date.now() + (parseInt(options.duration) * 24 * 60 * 60 * 1000));

      // Create DAO token
      const daoMint = await createMint(
        connection,
        provider.wallet,
        provider.wallet.publicKey,
        null,
        9
      );

      // Get program addresses
      const daoState = await getDAOStateAddress(provider.wallet.publicKey);
      const treasury = await getTreasuryAddress(daoState);

      // Create initialization instruction
      const initData = {
        fundraiseTarget,
        minPrice,
        expiryDate,
      };

      const initBuffer = Buffer.alloc(1000);
      layouts.initialize.encode(initData, initBuffer);
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: provider.wallet.publicKey, isSigner: true, isWritable: false },
          { pubkey: daoState, isSigner: false, isWritable: true },
          { pubkey: treasury, isSigner: false, isWritable: true },
          { pubkey: daoMint, isSigner: false, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
        ],
        programId: new PublicKey(config.programs.dao),
        data: Buffer.concat([Buffer.from([config.instructions.initialize.index]), initBuffer.slice(0, layouts.initialize.getSpan())]),
      });

      const tx = new Transaction().add(instruction);
      await provider.sendAndConfirm(tx);

      // Save to config
      const localConfig = loadConfig();
      localConfig.daoAddress = daoState.toString();
      localConfig.daoToken = daoMint.toString();
      saveConfig(localConfig);

      spinner.succeed('DAO initialized successfully!');
      console.log(chalk.green(`DAO Address: ${daoState}`));
      console.log(chalk.green(`DAO Token: ${daoMint}`));
      console.log(chalk.green(`Treasury: ${treasury}`));
    } catch (error) {
      spinner.fail('Failed to initialize DAO');
      console.error(chalk.red('Error:'), error);
    }
  });

program
  .command('create-pool')
  .description('Create Orca pool for DAO token')
  .requiredOption('-s, --sol <amount>', 'Initial SOL amount')
  .requiredOption('-t, --tokens <amount>', 'Initial token amount')
  .action(async (options) => {
    const localConfig = loadConfig();
    if (!localConfig.daoToken) {
      console.error(chalk.red('DAO token not found. Please initialize DAO first.'));
      return;
    }

    const spinner = ora('Creating Orca pool...').start();
    try {
      const provider = getAnchorProvider();
      const ctx = WhirlpoolContext.withProvider(provider, new PublicKey(config.programs.orca));
      const client = buildWhirlpoolClient(ctx);

      // Calculate amounts
      const solAmount = new BN(options.sol).mul(new BN(1e9));
      const tokenAmount = new BN(options.tokens).mul(new BN(1e9));

      // Get token accounts
      const tokenAAccount = await getAssociatedTokenAddress(
        new PublicKey(localConfig.daoToken),
        provider.wallet.publicKey
      );

      const tokenBAccount = await getAssociatedTokenAddress(
        new PublicKey('So11111111111111111111111111111111111111112'), // Wrapped SOL
        provider.wallet.publicKey
      );

      // Create pool configuration
      const poolConfig = {
        tokenMintA: new PublicKey(localConfig.daoToken),
        tokenMintB: new PublicKey('So11111111111111111111111111111111111111112'),
        tickSpacing: 64,
        initialSqrtPrice: PriceMath.priceToSqrtPriceX64(1),
      };

      // Create whirlpool
      const { poolKey, tx } = await client.createPool(
        provider.wallet.publicKey,
        poolConfig,
        Percentage.fromFraction(40, 10000), // 0.4% fee tier
      );

      await provider.sendAndConfirm(tx);

      // Initialize pool with liquidity
      const pool = await client.getPool(poolKey);
      const position = await pool.openPosition(
        provider.wallet.publicKey,
        -1000, // Lower tick index
        1000,  // Upper tick index
        tokenAmount,
        solAmount,
        Percentage.fromFraction(50, 10000) // 0.5% slippage
      );

      spinner.succeed('Pool created successfully!');
      console.log(chalk.green(`Pool Address: ${poolKey}`));
      console.log(chalk.green(`Position: ${position.positionMint}`));
      
      // Save pool address
      localConfig.poolAddress = poolKey.toString();
      saveConfig(localConfig);
    } catch (error) {
      spinner.fail('Failed to create pool');
      console.error(chalk.red('Error:'), error);
    }
  });

program
  .command('stake')
  .description('Stake LP tokens')
  .requiredOption('-a, --amount <amount>', 'Amount of LP tokens to stake')
  .action(async (options) => {
    const localConfig = loadConfig();
    if (!localConfig.poolAddress) {
      console.error(chalk.red('Pool not found. Please create pool first.'));
      return;
    }

    const spinner = ora('Staking LP tokens...').start();
    try {
      const provider = getAnchorProvider();
      const amount = new BN(options.amount).mul(new BN(1e9));

      // Get staking accounts
      const [stakingAccount] = await PublicKey.findProgramAddress(
        [Buffer.from('staking'), provider.wallet.publicKey.toBuffer()],
        new PublicKey(config.programs.staking)
      );

      // Create stake instruction
      const stakeData = { amount };
      const dataBuffer = Buffer.alloc(1000);
      layouts.stake.encode(stakeData, dataBuffer);

      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: provider.wallet.publicKey, isSigner: true, isWritable: false },
          { pubkey: stakingAccount, isSigner: false, isWritable: true },
          { pubkey: new PublicKey(localConfig.poolAddress), isSigner: false, isWritable: true },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        programId: new PublicKey(config.programs.staking),
        data: Buffer.concat([Buffer.from([config.instructions.stake.index]), dataBuffer.slice(0, layouts.stake.getSpan())]),
      });

      const tx = new Transaction().add(instruction);
      await provider.sendAndConfirm(tx);

      spinner.succeed('Successfully staked LP tokens!');
      console.log(chalk.green(`Amount staked: ${options.amount}`));
      console.log(chalk.green(`Staking account: ${stakingAccount}`));
    } catch (error) {
      spinner.fail('Failed to stake LP tokens');
      console.error(chalk.red('Error:'), error);
    }
  });

// Other commands remain the same...

program.parse(process.argv);
