# Руководство по Solana программе

Программа Aurex Solana Bridge - это смарт-контракт, который управляет виртуальными криптокартами на блокчейне Solana.

## Архитектура программы

Программа состоит из нескольких ключевых компонентов:

### Типы аккаунтов

1. **BridgeState**: Глобальный аккаунт состояния, содержащий конфигурацию программы
2. **Card**: Индивидуальные аккаунты виртуальных карт, принадлежащие пользователям
3. **Escrow**: Токен-аккаунты, которые хранят балансы карт

### Инструкции

#### `initialize`
Инициализирует мост с аккаунтом администратора.

```rust
pub fn initialize(ctx: Context<Initialize>, authority: Pubkey) -> Result<()>
```

#### `create_card`
Создает новую виртуальную карту для пользователя.

```rust
pub fn create_card(
    ctx: Context<CreateCard>,
    card_id: String,
    balance_limit: u64,
    metadata: String,
) -> Result<()>
```

#### `top_up_card`
Добавляет средства на виртуальную карту.

```rust
pub fn top_up_card(ctx: Context<TopUpCard>, amount: u64) -> Result<()>
```

#### `process_payment`
Обрабатывает платеж с виртуальной карты продавцу.

```rust
pub fn process_payment(
    ctx: Context<ProcessPayment>,
    amount: u64,
    merchant_reference: String,
) -> Result<()>
```

#### `deactivate_card`
Деактивирует виртуальную карту.

```rust
pub fn deactivate_card(ctx: Context<DeactivateCard>) -> Result<()>
```

#### `withdraw_balance`
Выводит оставшийся баланс с деактивированной карты.

```rust
pub fn withdraw_balance(ctx: Context<WithdrawBalance>) -> Result<()>
```

## События

Программа генерирует следующие события:

- `CardCreated`: Когда создается новая карта
- `CardToppedUp`: Когда карта пополняется средствами
- `PaymentProcessed`: Когда обрабатывается платеж
- `CardDeactivated`: Когда карта деактивируется
- `BalanceWithdrawn`: Когда выводится баланс

## Обработка ошибок

Программа определяет пользовательские коды ошибок для различных сценариев сбоев:

- `CardIdTooLong`: ID карты превышает 32 символа
- `MetadataTooLong`: Метаданные превышают 256 символов
- `CardInactive`: Попытка использования неактивной карты
- `BalanceLimitExceeded`: Пополнение превысило бы лимит баланса
- `InsufficientBalance`: Недостаточно средств для платежа
- `MerchantReferenceTooLong`: Ссылка продавца превышает 64 символа

## Соображения безопасности

- Все операции с картами требуют подписи владельца карты
- Средства хранятся в escrow аккаунтах, контролируемых программой
- Лимиты баланса предотвращают чрезмерное пополнение
- Карты могут быть деактивированы для предотвращения дальнейшего использования

## Тестирование

Запустите тесты с помощью:
```bash
anchor test
```

## Развертывание

Разверните на devnet:
```bash
anchor build
anchor deploy --provider.cluster devnet
```

## Пример использования

### Создание карты
```typescript
await program.methods
  .createCard("test-card-123", new anchor.BN(1000000000), "Тестовая карта")
  .accounts({
    card: cardPDA,
    cardEscrowAccount: escrowPDA,
    bridgeState: bridgeStatePDA,
    owner: user.publicKey,
    mint: tokenMint,
    // ... другие аккаунты
  })
  .signers([user])
  .rpc();
```

### Пополнение карты
```typescript
await program.methods
  .topUpCard(new anchor.BN(100000000)) // 100 токенов
  .accounts({
    card: cardPDA,
    cardEscrowAccount: escrowPDA,
    userTokenAccount: userTokenAccountPDA,
    owner: user.publicKey,
    // ... другие аккаунты
  })
  .signers([user])
  .rpc();
```

### Обработка платежа
```typescript
await program.methods
  .processPayment(new anchor.BN(50000000), "ORDER-12345")
  .accounts({
    card: cardPDA,
    cardEscrowAccount: escrowPDA,
    merchantTokenAccount: merchantTokenAccountPDA,
    merchant: merchant.publicKey,
    owner: user.publicKey,
    // ... другие аккаунты
  })
  .signers([user])
  .rpc();
```

## Структура аккаунтов

### Card Account
```rust
pub struct Card {
    pub id: String,          // ID карты (до 32 символов)
    pub owner: Pubkey,       // Владелец карты
    pub balance: u64,        // Текущий баланс
    pub balance_limit: u64,  // Лимит баланса
    pub is_active: bool,     // Статус активности
    pub metadata: String,    // Метаданные (до 256 символов)
    pub created_at: i64,     // Время создания
    pub bump: u8,            // Bump для PDA
}
```

### BridgeState Account
```rust
pub struct BridgeState {
    pub authority: Pubkey,   // Администратор моста
    pub total_cards: u64,    // Общее количество карт
    pub bump: u8,            // Bump для PDA
}
```

## PDA (Program Derived Addresses)

### Bridge State PDA
```rust
let (bridge_state, bump) = Pubkey::find_program_address(
    &[b"bridge_state"],
    program_id
);
```

### Card PDA
```rust
let (card, bump) = Pubkey::find_program_address(
    &[b"card", owner.as_ref(), card_id.as_bytes()],
    program_id
);
```

### Escrow PDA
```rust
let (escrow, bump) = Pubkey::find_program_address(
    &[b"escrow", card.as_ref()],
    program_id
);
```

## Лимиты и ограничения

- **ID карты**: максимум 32 символа
- **Метаданные**: максимум 256 символов
- **Ссылка продавца**: максимум 64 символа
- **Лимит баланса**: настраивается при создании карты
- **Активность карты**: только активные карты могут обрабатывать платежи

## Мониторинг и логирование

Программа генерирует подробные логи для всех операций:

```rust
msg!("Aurex Solana Bridge initialized with authority: {}", authority);
msg!("Card created: {}", card_id);
msg!("Payment processed: {} tokens", amount);
```

Эти логи можно мониторить с помощью:
```bash
solana logs <program_id>
```