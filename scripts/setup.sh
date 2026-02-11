#!/bin/bash

# Aurex Solana Bridge Setup Script
echo "🚀 Setting up Aurex Solana Bridge..."

# Check prerequisites
echo "📋 Checking prerequisites..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18 or later."
    exit 1
fi

# Check if Rust is installed
if ! command -v rustc &> /dev/null; then
    echo "❌ Rust is not installed. Please install Rust 1.70 or later."
    exit 1
fi

# Check if Solana CLI is installed
if ! command -v solana &> /dev/null; then
    echo "❌ Solana CLI is not installed. Installing..."
    sh -c "$(curl -sSfL https://release.solana.com/v1.16.0/install)"
    export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
fi

# Check if Anchor is installed
if ! command -v anchor &> /dev/null; then
    echo "❌ Anchor is not installed. Installing..."
    npm install -g @coral-xyz/anchor-cli
fi

echo "✅ All prerequisites are installed"

# Set up Solana devnet
echo "🔧 Configuring Solana for devnet..."
solana config set --url devnet

# Generate keypair if it doesn't exist
if [ ! -f ~/.config/solana/id.json ]; then
    echo "🔑 Generating new Solana keypair..."
    solana-keygen new --outfile ~/.config/solana/id.json --no-bip39-passphrase
fi

# Airdrop SOL for testing
echo "💰 Requesting SOL airdrop for testing..."
solana airdrop 2

# Install dependencies for all packages
echo "📦 Installing dependencies..."

# Install SDK dependencies
echo "Installing SDK dependencies..."
cd sdk && npm install && cd ..

# Install API dependencies
echo "Installing API dependencies..."
cd api && npm install && cd ..

# Build Solana program
echo "🔨 Building Solana program..."
cd program
anchor build
cd ..

# Generate program keypair
echo "🔑 Generating program keypair..."
if [ ! -f program/target/deploy/aurex_solana_bridge-keypair.json ]; then
    solana-keygen new --outfile program/target/deploy/aurex_solana_bridge-keypair.json --no-bip39-passphrase
fi

# Create environment files
echo "📝 Creating environment files..."

# API environment file
if [ ! -f api/.env ]; then
    cat > api/.env << EOL
PORT=3000
NODE_ENV=development
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_PRIVATE_KEY=$(cat ~/.config/solana/id.json)
AUREX_API_URL=https://api.aurex.cash
AUREX_API_KEY=your-aurex-api-key-here
LOG_LEVEL=info
EOL
    echo "📝 Created api/.env - Please update AUREX_API_KEY"
fi

# SDK environment file
if [ ! -f sdk/.env ]; then
    cat > sdk/.env << EOL
SOLANA_RPC_URL=https://api.devnet.solana.com
PROGRAM_ID=$(solana-keygen pubkey program/target/deploy/aurex_solana_bridge-keypair.json)
EOL
    echo "📝 Created sdk/.env"
fi

# Create logs directory
mkdir -p api/logs

echo "✅ Setup complete!"
echo ""
echo "🎯 Next steps:"
echo "1. Update AUREX_API_KEY in api/.env"
echo "2. Deploy the program: ./scripts/deploy-devnet.sh"
echo "3. Start the API server: cd api && npm run dev"
echo ""
echo "💡 Useful commands:"
echo "- Build all: npm run build"
echo "- Test all: npm run test"
echo "- Deploy: ./scripts/deploy-devnet.sh"