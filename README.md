# Aurex Solana Bridge 

A comprehensive Solana blockchain integration for Aurex Cash virtual crypto cards, enabling seamless DeFi payments and cross-chain operations.

## 🎯 Features

- **Virtual Card Management**: Create and manage virtual crypto cards on Solana
- **Cross-Chain Payments**: Bridge payments between Solana and traditional payment systems  
- **DeFi Integration**: Enable DeFi protocols to interact with Aurex virtual cards
- **Real-time Settlement**: Instant payment processing using Solana's high-speed blockchain
- **Security First**: Multi-signature wallets and secure card operations

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Aurex API     │◄──►│  Solana Bridge   │◄──►│ Solana Program  │
│                 │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │   Client SDK     │
                       │                  │
                       └──────────────────┘
```

## 📦 Project Structure

```
aurex-solana-bridge/
├── program/              # Rust Solana program
│   ├── src/
│   └── Cargo.toml
├── sdk/                  # TypeScript SDK
│   ├── src/
│   └── package.json
├── api/                  # Bridge API server  
│   ├── src/
│   └── package.json
├── docs/                 # Documentation
└── scripts/              # Deployment scripts
```

## 🚀 Quick Start

### Prerequisites
- Rust 1.70+
- Node.js 18+
- Solana CLI
- Anchor Framework

### Installation

1. Clone the repository:
```bash
git clone https://github.com/aurexcashgit/aurex-solana-bridge
cd aurex-solana-bridge
```

2. Install dependencies:
```bash
./scripts/setup.sh
```

3. Deploy to devnet:
```bash
./scripts/deploy-devnet.sh
```

## 🔧 Development

- `npm run build` - Build all packages
- `npm run test` - Run tests
- `npm run deploy` - Deploy to Solana
- `npm run dev` - Start development server

## 📚 Documentation

- [Program Guide](./docs/program.md) - Solana program documentation
- [SDK Reference](./docs/sdk.md) - Client SDK usage
- [API Reference](./docs/api.md) - Bridge API endpoints
- [Security](./docs/security.md) - Security considerations

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) for details

## 🔗 Links

- [Aurex Cash](https://aurex.cash) - Main platform
- [Solana Docs](https://docs.solana.com) - Solana documentation
- [Anchor Docs](https://www.anchor-lang.com) - Anchor framework

---

Built with ❤️ for the Solana ecosystem
