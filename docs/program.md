# Solana Program Guide

The Aurex Solana Bridge program is a smart contract that manages virtual crypto cards on the Solana blockchain.

## Program Architecture

The program consists of several key components:

### Account Types

1. **BridgeState**: Global state account containing program configuration
2. **Card**: Individual virtual card accounts owned by users
3. **Escrow**: Token accounts that hold card balances

### Instructions

#### `initialize`
Initializes the bridge with an authority account.

```rust
pub fn initialize(ctx: Context<Initialize>, authority: Pubkey) -> Result<()>
```

#### `create_card`
Creates a new virtual card for a user.

```rust
pub fn create_card(
    ctx: Context<CreateCard>,
    card_id: String,
    balance_limit: u64,
    metadata: String,
) -> Result<()>
```

#### `top_up_card`
Adds funds to a virtual card.

```rust
pub fn top_up_card(ctx: Context<TopUpCard>, amount: u64) -> Result<()>
```

#### `process_payment`
Processes a payment from a virtual card to a merchant.

```rust
pub fn process_payment(
    ctx: Context<ProcessPayment>,
    amount: u64,
    merchant_reference: String,
) -> Result<()>
```

#### `deactivate_card`
Deactivates a virtual card.

```rust
pub fn deactivate_card(ctx: Context<DeactivateCard>) -> Result<()>
```

#### `withdraw_balance`
Withdraws remaining balance from a deactivated card.

```rust
pub fn withdraw_balance(ctx: Context<WithdrawBalance>) -> Result<()>
```

## Events

The program emits the following events:

- `CardCreated`: When a new card is created
- `CardToppedUp`: When a card is topped up with funds
- `PaymentProcessed`: When a payment is processed
- `CardDeactivated`: When a card is deactivated
- `BalanceWithdrawn`: When balance is withdrawn

## Error Handling

The program defines custom error codes for various failure scenarios:

- `CardIdTooLong`: Card ID exceeds 32 characters
- `MetadataTooLong`: Metadata exceeds 256 characters
- `CardInactive`: Attempting to use an inactive card
- `BalanceLimitExceeded`: Top-up would exceed balance limit
- `InsufficientBalance`: Insufficient funds for payment
- `MerchantReferenceTooLong`: Merchant reference exceeds 64 characters

## Security Considerations

- All card operations require the card owner's signature
- Funds are held in escrow accounts controlled by the program
- Balance limits prevent excessive top-ups
- Cards can be deactivated to prevent further use

## Testing

Run tests with:
```bash
anchor test
```

## Deployment

Deploy to devnet:
```bash
anchor build
anchor deploy --provider.cluster devnet
```