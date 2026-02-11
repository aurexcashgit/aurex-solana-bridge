#!/usr/bin/env node

const { Command } = require('commander');
const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

const program = new Command();

// Configuration
const DEFAULT_RPC_URL = 'https://api.devnet.solana.com';
const DEFAULT_KEYPAIR_PATH = process.env.HOME + '/.config/solana/id.json';

// Utility functions
function loadKeypair(keypairPath = DEFAULT_KEYPAIR_PATH) {
  try {
    const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
    return Keypair.fromSecretKey(Uint8Array.from(keypairData));
  } catch (error) {
    console.error(`❌ Failed to load keypair from ${keypairPath}`);
    console.error(error.message);
    process.exit(1);
  }
}

function createConnection(rpcUrl = DEFAULT_RPC_URL) {
  return new Connection(rpcUrl, 'confirmed');
}

// Commands

program
  .name('aurex-cli')
  .description('Aurex Solana Bridge CLI Tool')
  .version('0.1.0');

// Status command
program
  .command('status')
  .description('Check bridge and account status')
  .option('-r, --rpc-url <url>', 'Solana RPC URL', DEFAULT_RPC_URL)
  .option('-k, --keypair <path>', 'Path to keypair file', DEFAULT_KEYPAIR_PATH)
  .action(async (options) => {
    console.log('🔍 Checking bridge status...\n');
    
    const connection = createConnection(options.rpcUrl);
    const keypair = loadKeypair(options.keypair);
    
    try {
      // Check connection
      const version = await connection.getVersion();
      console.log(`✅ Connected to Solana cluster: ${options.rpcUrl}`);
      console.log(`📊 Solana version: ${version['solana-core']}`);
      
      // Check balance
      const balance = await connection.getBalance(keypair.publicKey);
      console.log(`💰 Account balance: ${balance / 1e9} SOL`);
      console.log(`🔑 Public key: ${keypair.publicKey.toBase58()}`);
      
      // Check program deployment (if program ID is available)
      if (process.env.PROGRAM_ID) {
        const programId = new PublicKey(process.env.PROGRAM_ID);
        const accountInfo = await connection.getAccountInfo(programId);
        
        if (accountInfo) {
          console.log(`✅ Program deployed: ${programId.toBase58()}`);
          console.log(`📦 Program size: ${accountInfo.data.length} bytes`);
        } else {
          console.log(`❌ Program not found: ${programId.toBase58()}`);
        }
      }
      
    } catch (error) {
      console.error('❌ Error checking status:', error.message);
      process.exit(1);
    }
  });

// Initialize bridge command
program
  .command('init')
  .description('Initialize the Aurex bridge')
  .option('-r, --rpc-url <url>', 'Solana RPC URL', DEFAULT_RPC_URL)
  .option('-k, --keypair <path>', 'Path to keypair file', DEFAULT_KEYPAIR_PATH)
  .option('-p, --program-id <id>', 'Program ID', process.env.PROGRAM_ID)
  .action(async (options) => {
    console.log('🚀 Initializing Aurex bridge...\n');
    
    if (!options.programId) {
      console.error('❌ Program ID required. Set PROGRAM_ID environment variable or use --program-id');
      process.exit(1);
    }
    
    const connection = createConnection(options.rpcUrl);
    const keypair = loadKeypair(options.keypair);
    
    try {
      // TODO: Implement bridge initialization using SDK
      console.log('✅ Bridge initialization would be implemented here');
      console.log(`🔑 Authority: ${keypair.publicKey.toBase58()}`);
      console.log(`📍 Program: ${options.programId}`);
      
    } catch (error) {
      console.error('❌ Error initializing bridge:', error.message);
      process.exit(1);
    }
  });

// Create card command
program
  .command('create-card')
  .description('Create a new virtual card')
  .option('-r, --rpc-url <url>', 'Solana RPC URL', DEFAULT_RPC_URL)
  .option('-k, --keypair <path>', 'Path to keypair file', DEFAULT_KEYPAIR_PATH)
  .option('-p, --program-id <id>', 'Program ID', process.env.PROGRAM_ID)
  .option('-i, --card-id <id>', 'Card ID (default: random)')
  .option('-l, --limit <amount>', 'Balance limit in tokens', '1000')
  .option('-m, --metadata <data>', 'Card metadata', '')
  .action(async (options) => {
    console.log('💳 Creating virtual card...\n');
    
    const cardId = options.cardId || `card-${Date.now()}`;
    const balanceLimit = parseFloat(options.limit);
    
    try {
      // TODO: Implement card creation using SDK
      console.log('✅ Card creation would be implemented here');
      console.log(`🆔 Card ID: ${cardId}`);
      console.log(`💰 Balance limit: ${balanceLimit} tokens`);
      console.log(`📝 Metadata: ${options.metadata}`);
      
    } catch (error) {
      console.error('❌ Error creating card:', error.message);
      process.exit(1);
    }
  });

// List cards command
program
  .command('list-cards')
  .description('List all cards for the current user')
  .option('-r, --rpc-url <url>', 'Solana RPC URL', DEFAULT_RPC_URL)
  .option('-k, --keypair <path>', 'Path to keypair file', DEFAULT_KEYPAIR_PATH)
  .option('-p, --program-id <id>', 'Program ID', process.env.PROGRAM_ID)
  .action(async (options) => {
    console.log('📋 Listing virtual cards...\n');
    
    const connection = createConnection(options.rpcUrl);
    const keypair = loadKeypair(options.keypair);
    
    try {
      // TODO: Implement card listing using SDK
      console.log('✅ Card listing would be implemented here');
      console.log(`👤 Owner: ${keypair.publicKey.toBase58()}`);
      
    } catch (error) {
      console.error('❌ Error listing cards:', error.message);
      process.exit(1);
    }
  });

// Deploy command
program
  .command('deploy')
  .description('Deploy the Solana program')
  .option('-c, --cluster <cluster>', 'Solana cluster (devnet, testnet, mainnet)', 'devnet')
  .action(async (options) => {
    console.log(`🚀 Deploying to ${options.cluster}...\n`);
    
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);
    
    try {
      // Set cluster
      console.log(`🔧 Setting cluster to ${options.cluster}...`);
      await execAsync(`solana config set --url ${options.cluster}`);
      
      // Build program
      console.log('🔨 Building program...');
      await execAsync('anchor build', { cwd: './program' });
      
      // Deploy program
      console.log('📦 Deploying program...');
      const { stdout } = await execAsync(`anchor deploy --provider.cluster ${options.cluster}`, { cwd: './program' });
      console.log(stdout);
      
      // Get program ID
      const { stdout: programId } = await execAsync('solana-keygen pubkey ./program/target/deploy/aurex_solana_bridge-keypair.json');
      console.log(`✅ Program deployed successfully!`);
      console.log(`🆔 Program ID: ${programId.trim()}`);
      
    } catch (error) {
      console.error('❌ Deployment failed:', error.message);
      process.exit(1);
    }
  });

// Airdrop command
program
  .command('airdrop')
  .description('Request SOL airdrop (devnet only)')
  .option('-a, --amount <amount>', 'Amount of SOL to airdrop', '2')
  .option('-r, --rpc-url <url>', 'Solana RPC URL', DEFAULT_RPC_URL)
  .option('-k, --keypair <path>', 'Path to keypair file', DEFAULT_KEYPAIR_PATH)
  .action(async (options) => {
    console.log(`💧 Requesting ${options.amount} SOL airdrop...\n`);
    
    const connection = createConnection(options.rpcUrl);
    const keypair = loadKeypair(options.keypair);
    
    if (!options.rpcUrl.includes('devnet')) {
      console.error('❌ Airdrop only available on devnet');
      process.exit(1);
    }
    
    try {
      const signature = await connection.requestAirdrop(
        keypair.publicKey,
        parseFloat(options.amount) * 1e9
      );
      
      console.log(`📨 Airdrop requested: ${signature}`);
      console.log('⏳ Confirming transaction...');
      
      await connection.confirmTransaction(signature);
      
      const balance = await connection.getBalance(keypair.publicKey);
      console.log(`✅ Airdrop successful!`);
      console.log(`💰 New balance: ${balance / 1e9} SOL`);
      
    } catch (error) {
      console.error('❌ Airdrop failed:', error.message);
      process.exit(1);
    }
  });

// Parse arguments and execute
program.parse();

module.exports = program;