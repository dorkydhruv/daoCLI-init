// import { Command } from 'commander';
// import chalk from 'chalk';
// import { ConnectionService } from '../services/connection-service';
// import { WalletService } from '../services/wallet-service';
// import { MultisigService } from '../services/multisig-service';
// import { GovernanceService } from '../services/governance-service';
// import { ConfigService } from '../services/config-service';
// import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';

// export function registerProposalCommands(program: Command): void {
//   const proposalCommand = program.command('proposal')
//     .description('Proposal management commands');

//   proposalCommand
//     .command('create')
//     .description('Create a new proposal')
//     .option('-n, --name <string>', 'Name of the proposal', 'My Proposal')
//     .option('-d, --description <string>', 'Description of the proposal', '')
//     .option('-t, --type <string>', 'Type of proposal: transfer-sol, add-member, remove-member', 'transfer-sol')
//     .option('-a, --amount <number>', 'Amount of SOL to transfer (for transfer-sol)', '1')
//     .option('-r, --recipient <string>', 'Recipient address (for transfer-sol or add-member)')
//     .action(async (options) => {
//       try {
//         // Load wallet and connection
//         const wallet = await WalletService.loadWallet();
//         if (!wallet) {
//           console.log(chalk.red('No wallet configured. Please create a wallet first.'));
//           return;
//         }

//         const config = await ConfigService.getConfig();
//         if (!config.dao?.activeRealm || !config.dao?.activeMultisig) {
//           console.log(chalk.yellow('No DAO configured. Use "dao init" to create one.'));
//           return;
//         }

//         const connection = await ConnectionService.getConnection();
//         const keypair = WalletService.getKeypair(wallet);

//         const realmAddress = new PublicKey(config.dao.activeRealm);
//         const multisigPda = new PublicKey(config.dao.activeMultisig);

//         console.log(chalk.blue('Creating proposal:'));
//         console.log(`Name: ${options.name}`);
//         console.log(`Type: ${options.type}`);

//         let instructions = [];

//         // Build instructions based on proposal type
//         switch (options.type) {
//           case 'transfer-sol':
//             if (!options.recipient) {
//               console.log(chalk.red('Recipient address is required for transfer-sol proposals.'));
//               return;
//             }

//             const amount = parseFloat(options.amount) * LAMPORTS_PER_SOL;
//             const recipient = new PublicKey(options.recipient);

//             console.log(`Amount: ${options.amount} SOL`);
//             console.log(`Recipient: ${recipient.toBase58()}`);

//             instructions.push(
//               SystemProgram.transfer({
//                 fromPubkey: multisigPda,
//                 toPubkey: recipient,
//                 lamports: amount
//               })
//             );
//             break;

//           case 'add-member':
//             if (!options.recipient) {
//               console.log(chalk.red('Member address is required for add-member proposals.'));
//               return;
//             }

//             const newMember = new PublicKey(options.recipient);
//             console.log(`Adding member: ${newMember.toBase58()}`);

//             // Here you would add instruction to add a member to the multisig
//             // This is a placeholder as the actual implementation depends on your multisig structure
//             console.log(chalk.yellow('⚠️ add-member instruction is not fully implemented yet.'));
//             break;

//           case 'remove-member':
//             if (!options.recipient) {
//               console.log(chalk.red('Member address is required for remove-member proposals.'));
//               return;
//             }

//             const memberToRemove = new PublicKey(options.recipient);
//             console.log(`Removing member: ${memberToRemove.toBase58()}`);

//             // Here you would add instruction to remove a member from the multisig
//             // This is a placeholder as the actual implementation depends on your multisig structure
//             console.log(chalk.yellow('⚠️ remove-member instruction is not fully implemented yet.'));
//             break;

//           default:
//             console.log(chalk.red(`Unknown proposal type: ${options.type}`));
//             return;
//         }

//         // 1. First create a multisig transaction proposal
//         console.log(chalk.blue('\nCreating multisig transaction...'));
//         const transactionPda = await MultisigService.proposeTransaction(
//           connection,
//           mult
