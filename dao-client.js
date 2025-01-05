import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, Transaction, TransactionInstruction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import { struct } from '@coral-xyz/borsh';
import BN from 'bn.js';

export class DAOClient {
  constructor(provider, config) {
    this.provider = provider;
    this.config = config;
    this.program = new PublicKey(config.programs.dao);
  }

  async getDAOStateAddress(manager) {
    const [daoState] = await PublicKey.findProgramAddress(
      [Buffer.from('dao_state'), manager.toBuffer()],
      this.program
    );
    return daoState;
  }

  async getTreasuryAddress(daoState) {
    const [treasury] = await PublicKey.findProgramAddress(
      [Buffer.from('treasury'), daoState.toBuffer()],
      this.program
    );
    return treasury;
  }

  async getStakingAddress(user) {
    const [stakingAccount] = await PublicKey.findProgramAddress(
      [Buffer.from('staking'), user.toBuffer()],
      this.program
    );
    return stakingAccount;
  }

  async createInitializeInstruction(daoState, treasury, daoToken, fundraiseTarget, minPrice, expiryDate) {
    const layout = struct(this.config.instructions.initialize.layout);
    const data = {
      fundraiseTarget: new BN(fundraiseTarget),
      minPrice: new BN(minPrice),
      expiryDate: new BN(expiryDate),
    };

    const dataBuffer = Buffer.alloc(1000);
    layout.encode(data, dataBuffer);

    return new TransactionInstruction({
      keys: [
        { pubkey: this.provider.wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: daoState, isSigner: false, isWritable: true },
        { pubkey: treasury, isSigner: false, isWritable: true },
        { pubkey: daoToken, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      programId: this.program,
      data: Buffer.concat([
        Buffer.from([this.config.instructions.initialize.index]), 
        dataBuffer.slice(0, layout.getSpan())
      ]),
    });
  }

  async createStakeInstruction(daoState, stakingAccount, userLPToken, poolLPToken, amount) {
    const layout = struct(this.config.instructions.stake.layout);
    const data = {
      amount: new BN(amount),
    };

    const dataBuffer = Buffer.alloc(1000);
    layout.encode(data, dataBuffer);

    return new TransactionInstruction({
      keys: [
        { pubkey: daoState, isSigner: false, isWritable: true },
        { pubkey: stakingAccount, isSigner: false, isWritable: true },
        { pubkey: this.provider.wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: userLPToken, isSigner: false, isWritable: true },
        { pubkey: poolLPToken, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      programId: this.program,
      data: Buffer.concat([
        Buffer.from([this.config.instructions.stake.index]),
        dataBuffer.slice(0, layout.getSpan())
      ]),
    });
  }

  // Helper method to create associated token accounts
  async getOrCreateAssociatedTokenAccount(mint, owner) {
    const ata = await getAssociatedTokenAddress(mint, owner);
    try {
      await this.provider.connection.getTokenAccountBalance(ata);
      return ata;
    } catch {
      const ix = await this.createAssociatedTokenAccountInstruction(mint, ata, owner);
      const tx = new Transaction().add(ix);
      await this.provider.sendAndConfirm(tx);
      return ata;
    }
  }
}

export const initializeDAO = async (client, options) => {
  const daoState = await client.getDAOStateAddress(client.provider.wallet.publicKey);
  const treasury = await client.getTreasuryAddress(daoState);
  
  const ix = await client.createInitializeInstruction(
    daoState,
    treasury,
    options.daoToken,
    options.fundraiseTarget,
    options.minPrice,
    options.expiryDate
  );

  const tx = new Transaction().add(ix);
  return client.provider.sendAndConfirm(tx);
};

export const stakeLPTokens = async (client, options) => {
  const daoState = await client.getDAOStateAddress(client.provider.wallet.publicKey);
  const stakingAccount = await client.getStakingAddress(client.provider.wallet.publicKey);
  
  // Get or create token accounts
  const userLPToken = await client.getOrCreateAssociatedTokenAccount(
    options.lpToken,
    client.provider.wallet.publicKey
  );
  const poolLPToken = await client.getOrCreateAssociatedTokenAccount(
    options.lpToken,
    daoState
  );

  const ix = await client.createStakeInstruction(
    daoState,
    stakingAccount,
    userLPToken,
    poolLPToken,
    options.amount
  );

  const tx = new Transaction().add(ix);
  return client.provider.sendAndConfirm(tx);
};