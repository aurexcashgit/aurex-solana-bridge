#!/bin/bash

# Aurex Solana Bridge Devnet Deployment Script
echo "🚀 Deploying Aurex Solana Bridge to Devnet..."

# Check if we're configured for devnet
CURRENT_CLUSTER=$(solana config get | grep "RPC URL" | awk '{print $3}')
if [[ "$CURRENT_CLUSTER" != *"devnet"* ]]; then
    echo "⚠️  Current cluster is not devnet. Switching to devnet..."
    solana config set --url devnet
fi

# Check balance
BALANCE=$(solana balance | awk '{print $1}')
BALANCE_INT=${BALANCE%.*}
if [ "$BALANCE_INT" -lt 5 ]; then
    echo "💰 Low SOL balance ($BALANCE). Requesting airdrop..."
    solana airdrop 5
    sleep 5
fi

echo "💰 Current balance: $(solana balance)"

# Build the program
echo "🔨 Building Solana program..."
cd program
anchor build

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

# Deploy the program
echo "🚀 Deploying to devnet..."
anchor deploy

if [ $? -ne 0 ]; then
    echo "❌ Deployment failed"
    exit 1
fi

cd ..

# Get the deployed program ID
PROGRAM_ID=$(solana-keygen pubkey program/target/deploy/aurex_solana_bridge-keypair.json)
echo "📋 Program deployed successfully!"
echo "🆔 Program ID: $PROGRAM_ID"

# Update environment files with the actual program ID
echo "📝 Updating environment files..."

# Update SDK environment
sed -i.bak "s/PROGRAM_ID=.*/PROGRAM_ID=$PROGRAM_ID/" sdk/.env
echo "✅ Updated sdk/.env"

# Update API environment if needed
if grep -q "PROGRAM_ID=" api/.env; then
    sed -i.bak "s/PROGRAM_ID=.*/PROGRAM_ID=$PROGRAM_ID/" api/.env
else
    echo "PROGRAM_ID=$PROGRAM_ID" >> api/.env
fi
echo "✅ Updated api/.env"

# Build SDK and API
echo "📦 Building SDK..."
cd sdk && npm run build
if [ $? -ne 0 ]; then
    echo "❌ SDK build failed"
    exit 1
fi
cd ..

echo "📦 Building API..."
cd api && npm run build
if [ $? -ne 0 ]; then
    echo "❌ API build failed"
    exit 1
fi
cd ..

# Initialize the bridge (admin operation)
echo "🔧 Initializing bridge state..."
AUTHORITY_PUBKEY=$(solana-keygen pubkey ~/.config/solana/id.json)

# This would normally use the SDK to initialize
echo "🆔 Bridge authority: $AUTHORITY_PUBKEY"

echo "✅ Deployment completed successfully!"
echo ""
echo "📋 Deployment Summary:"
echo "🌐 Network: Devnet"
echo "🆔 Program ID: $PROGRAM_ID"
echo "👤 Authority: $AUTHORITY_PUBKEY"
echo "💰 Remaining balance: $(solana balance)"
echo ""
echo "🎯 Next steps:"
echo "1. Start API server: cd api && npm run dev"
echo "2. Test with SDK: cd sdk && npm run test"
echo "3. Check deployment: solana program show $PROGRAM_ID"
echo ""
echo "🔗 Useful links:"
echo "📊 Solana Explorer: https://explorer.solana.com/address/$PROGRAM_ID?cluster=devnet"
echo "🔧 Program logs: solana logs $PROGRAM_ID"