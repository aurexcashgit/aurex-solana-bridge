# SDK Reference

The Aurex Solana Bridge SDK provides a TypeScript interface for interacting with the Solana program.

## Installation

```bash
npm install @aurex/solana-bridge-sdk
```

## Quick Start

```typescript
import { Connection, Keypair } from '@solana/web3.js';
import { AurexSolanaBridge, createWallet } from '@aurex/solana-bridge-sdk';

// Initialize connection
const connection = new Connection('https://api.devnet.solana.com');
const keypair = Keypair.generate(); // or load existing keypair
const wallet = createWallet(keypair);

// Create bridge instance
const bridge = new AurexSolanaBridge(connection, wallet);
```

## API Reference

### AurexSolanaBridge

Main class for interacting with the bridge program.

#### Constructor

```typescript
constructor(
  connection: Connection,
  wallet: Wallet,
  programId?: PublicKey
)
```

#### Methods

##### `createCard`
Creates a new virtual card.

```typescript
async createCard(params: CreateCardParams): Promise<{
  signature: string;
  cardPubkey: PublicKey;
  escrowPubkey: PublicKey;
}>
```

**Parameters:**
- `cardId`: Unique identifier for the card
- `balanceLimit`: Maximum balance allowed on the card
- `metadata`: Optional metadata string
- `mint`: Token mint address

**Example:**
```typescript
const result = await bridge.createCard({
  cardId: 'my-card-123',
  balanceLimit: 1000 * 1e6, // 1000 tokens
  metadata: 'Personal card',
  mint: new PublicKey('So11111111111111111111111111111111111111112') // WSOL
});
```

##### `topUpCard`
Adds funds to a virtual card.

```typescript
async topUpCard(params: TopUpCardParams): Promise<string>
```

**Example:**
```typescript
const signature = await bridge.topUpCard({
  cardId: 'my-card-123',
  amount: 100 * 1e6, // 100 tokens
  mint: new PublicKey('So11111111111111111111111111111111111111112')
});
```

##### `processPayment`
Processes a payment from a virtual card.

```typescript
async processPayment(params: ProcessPaymentParams): Promise<string>
```

**Example:**
```typescript
const signature = await bridge.processPayment({
  cardId: 'my-card-123',
  amount: 50 * 1e6, // 50 tokens
  merchantTokenAccount: merchantAccount,
  merchant: merchantPubkey,
  merchantReference: 'ORDER-12345'
});
```

##### `getCard`
Retrieves card data.

```typescript
async getCard(owner: PublicKey, cardId: string): Promise<CardData | null>
```

##### `getUserCards`
Gets all cards for a user.

```typescript
async getUserCards(owner: PublicKey): Promise<CardData[]>
```

### Event Listeners

The SDK provides event listeners for real-time updates:

```typescript
// Listen for new cards
bridge.onCardCreated((event) => {
  console.log('New card created:', event.cardId);
});

// Listen for payments
bridge.onPaymentProcessed((event) => {
  console.log('Payment processed:', event.amount);
});
```

### Utility Functions

#### `createWallet`
Creates a wallet instance from a keypair.

```typescript
function createWallet(keypair: Keypair): Wallet
```

#### PDAs (Program Derived Addresses)

```typescript
// Get bridge state PDA
const [bridgeState] = AurexSolanaBridge.getBridgeStatePDA();

// Get card PDA
const [card] = AurexSolanaBridge.getCardPDA(owner, cardId);

// Get escrow PDA
const [escrow] = AurexSolanaBridge.getCardEscrowPDA(card);
```

## Error Handling

The SDK throws errors for various failure scenarios. Always wrap calls in try-catch blocks:

```typescript
try {
  const result = await bridge.createCard(params);
  console.log('Card created successfully:', result);
} catch (error) {
  console.error('Failed to create card:', error.message);
}
```

## Types

### CardData
```typescript
interface CardData {
  id: string;
  owner: PublicKey;
  balance: number;
  balanceLimit: number;
  isActive: boolean;
  metadata: string;
  createdAt: number;
  bump: number;
}
```

### Events
```typescript
interface CardCreatedEvent {
  cardPubkey: PublicKey;
  owner: PublicKey;
  cardId: string;
  balanceLimit: number;
}

interface PaymentProcessedEvent {
  cardPubkey: PublicKey;
  merchant: PublicKey;
  amount: number;
  merchantReference: string;
  remainingBalance: number;
  timestamp: number;
}
```

## Testing

```bash
npm run test
```

## Building

```bash
npm run build
```