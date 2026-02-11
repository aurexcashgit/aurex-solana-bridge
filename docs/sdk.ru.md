# Справочник SDK

Aurex Solana Bridge SDK предоставляет TypeScript интерфейс для взаимодействия с программой Solana.

## Установка

```bash
npm install @aurex/solana-bridge-sdk
```

## Быстрый старт

```typescript
import { Connection, Keypair } from '@solana/web3.js';
import { AurexSolanaBridge, createWallet } from '@aurex/solana-bridge-sdk';

// Инициализация соединения
const connection = new Connection('https://api.devnet.solana.com');
const keypair = Keypair.generate(); // или загрузите существующий keypair
const wallet = createWallet(keypair);

// Создание экземпляра моста
const bridge = new AurexSolanaBridge(connection, wallet);
```

## Справочник API

### AurexSolanaBridge

Основной класс для взаимодействия с программой моста.

#### Конструктор

```typescript
constructor(
  connection: Connection,
  wallet: Wallet,
  programId?: PublicKey
)
```

#### Методы

##### `createCard`
Создает новую виртуальную карту.

```typescript
async createCard(params: CreateCardParams): Promise<{
  signature: string;
  cardPubkey: PublicKey;
  escrowPubkey: PublicKey;
}>
```

**Параметры:**
- `cardId`: Уникальный идентификатор карты
- `balanceLimit`: Максимальный баланс, разрешенный на карте
- `metadata`: Опциональная строка метаданных
- `mint`: Адрес токен-минта

**Пример:**
```typescript
const result = await bridge.createCard({
  cardId: 'my-card-123',
  balanceLimit: 1000 * 1e6, // 1000 токенов
  metadata: 'Личная карта',
  mint: new PublicKey('So11111111111111111111111111111111111111112') // WSOL
});

console.log('Карта создана:', result.cardPubkey.toBase58());
console.log('Escrow аккаунт:', result.escrowPubkey.toBase58());
console.log('Подпись транзакции:', result.signature);
```

##### `topUpCard`
Добавляет средства на виртуальную карту.

```typescript
async topUpCard(params: TopUpCardParams): Promise<string>
```

**Пример:**
```typescript
const signature = await bridge.topUpCard({
  cardId: 'my-card-123',
  amount: 100 * 1e6, // 100 токенов
  mint: new PublicKey('So11111111111111111111111111111111111111112')
});

console.log('Карта пополнена, подпись:', signature);
```

##### `processPayment`
Обрабатывает платеж с виртуальной карты.

```typescript
async processPayment(params: ProcessPaymentParams): Promise<string>
```

**Пример:**
```typescript
const signature = await bridge.processPayment({
  cardId: 'my-card-123',
  amount: 50 * 1e6, // 50 токенов
  merchantTokenAccount: merchantAccount,
  merchant: merchantPubkey,
  merchantReference: 'ORDER-12345'
});

console.log('Платеж обработан, подпись:', signature);
```

##### `deactivateCard`
Деактивирует виртуальную карту.

```typescript
async deactivateCard(cardId: string): Promise<string>
```

**Пример:**
```typescript
const signature = await bridge.deactivateCard('my-card-123');
console.log('Карта деактивирована, подпись:', signature);
```

##### `withdrawBalance`
Выводит остаток с деактивированной карты.

```typescript
async withdrawBalance(cardId: string, mint: PublicKey): Promise<string>
```

**Пример:**
```typescript
const signature = await bridge.withdrawBalance(
  'my-card-123',
  new PublicKey('So11111111111111111111111111111111111111112')
);
console.log('Баланс выведен, подпись:', signature);
```

##### `getCard`
Получает данные карты.

```typescript
async getCard(owner: PublicKey, cardId: string): Promise<CardData | null>
```

**Пример:**
```typescript
const cardData = await bridge.getCard(ownerPubkey, 'my-card-123');
if (cardData) {
  console.log('Баланс карты:', cardData.balance);
  console.log('Лимит карты:', cardData.balanceLimit);
  console.log('Активна:', cardData.isActive);
}
```

##### `getUserCards`
Получает все карты пользователя.

```typescript
async getUserCards(owner: PublicKey): Promise<CardData[]>
```

**Пример:**
```typescript
const cards = await bridge.getUserCards(userPubkey);
console.log(`Найдено ${cards.length} карт:`);
cards.forEach(card => {
  console.log(`- ${card.id}: ${card.balance} токенов`);
});
```

### Слушатели событий

SDK предоставляет слушатели событий для обновлений в реальном времени:

```typescript
// Слушать создание новых карт
bridge.onCardCreated((event) => {
  console.log('Новая карта создана:', event.cardId);
  console.log('Лимит баланса:', event.balanceLimit);
});

// Слушать платежи
bridge.onPaymentProcessed((event) => {
  console.log('Платеж обработан:');
  console.log('- Сумма:', event.amount);
  console.log('- Продавец:', event.merchant.toBase58());
  console.log('- Ссылка:', event.merchantReference);
  console.log('- Остаток:', event.remainingBalance);
});
```

### Утилитарные функции

#### `createWallet`
Создает экземпляр кошелька из keypair.

```typescript
function createWallet(keypair: Keypair): Wallet
```

**Пример:**
```typescript
import { Keypair } from '@solana/web3.js';

// Генерация нового keypair
const keypair = Keypair.generate();
const wallet = createWallet(keypair);

// Загрузка из секретного ключа
const secretKey = [1, 2, 3, /* ... остальные байты */];
const keypairFromSecret = Keypair.fromSecretKey(Uint8Array.from(secretKey));
const walletFromSecret = createWallet(keypairFromSecret);
```

#### PDAs (Program Derived Addresses)

```typescript
// Получить PDA состояния моста
const [bridgeState] = AurexSolanaBridge.getBridgeStatePDA();

// Получить PDA карты
const [card] = AurexSolanaBridge.getCardPDA(owner, cardId);

// Получить PDA escrow
const [escrow] = AurexSolanaBridge.getCardEscrowPDA(card);
```

**Пример использования PDA:**
```typescript
const owner = wallet.publicKey;
const cardId = 'my-special-card';

const [cardPDA, cardBump] = AurexSolanaBridge.getCardPDA(owner, cardId);
const [escrowPDA, escrowBump] = AurexSolanaBridge.getCardEscrowPDA(cardPDA);

console.log('Адрес карты:', cardPDA.toBase58());
console.log('Адрес escrow:', escrowPDA.toBase58());
```

## Обработка ошибок

SDK выбрасывает ошибки для различных сценариев сбоев. Всегда оборачивайте вызовы в try-catch блоки:

```typescript
try {
  const result = await bridge.createCard(params);
  console.log('Карта создана успешно:', result);
} catch (error) {
  console.error('Не удалось создать карту:', error.message);
  
  // Специфическая обработка ошибок
  if (error.message.includes('CardIdTooLong')) {
    console.error('ID карты слишком длинный (максимум 32 символа)');
  } else if (error.message.includes('InsufficientBalance')) {
    console.error('Недостаточно средств на аккаунте');
  }
}
```

## Типы данных

### CardData
```typescript
interface CardData {
  id: string;              // ID карты
  owner: PublicKey;        // Владелец
  balance: number;         // Текущий баланс
  balanceLimit: number;    // Лимит баланса
  isActive: boolean;       // Статус активности
  metadata: string;        // Метаданные
  createdAt: number;       // Время создания (Unix timestamp)
  bump: number;            // Bump для PDA
}
```

### BridgeStateData
```typescript
interface BridgeStateData {
  authority: PublicKey;    // Администратор моста
  totalCards: number;      // Общее количество карт
  bump: number;            // Bump для PDA
}
```

### События

#### CardCreatedEvent
```typescript
interface CardCreatedEvent {
  cardPubkey: PublicKey;   // Адрес карты
  owner: PublicKey;        // Владелец
  cardId: string;          // ID карты
  balanceLimit: number;    // Лимит баланса
}
```

#### PaymentProcessedEvent
```typescript
interface PaymentProcessedEvent {
  cardPubkey: PublicKey;    // Адрес карты
  merchant: PublicKey;      // Продавец
  amount: number;           // Сумма платежа
  merchantReference: string; // Ссылка продавца
  remainingBalance: number; // Остающийся баланс
  timestamp: number;        // Время обработки
}
```

## Расширенные примеры

### Полный жизненный цикл карты

```typescript
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { AurexSolanaBridge, createWallet } from '@aurex/solana-bridge-sdk';

async function cardLifecycleExample() {
  // Настройка
  const connection = new Connection('https://api.devnet.solana.com');
  const userKeypair = Keypair.generate();
  const wallet = createWallet(userKeypair);
  const bridge = new AurexSolanaBridge(connection, wallet);
  
  const cardId = 'lifecycle-card-' + Date.now();
  const mint = new PublicKey('So11111111111111111111111111111111111111112'); // WSOL
  
  try {
    // 1. Создание карты
    console.log('📝 Создание карты...');
    const createResult = await bridge.createCard({
      cardId,
      balanceLimit: 1000 * 1e6, // 1000 токенов
      metadata: 'Тестовая карта жизненного цикла',
      mint
    });
    console.log('✅ Карта создана:', createResult.cardPubkey.toBase58());
    
    // 2. Пополнение карты
    console.log('💰 Пополнение карты...');
    const topUpSignature = await bridge.topUpCard({
      cardId,
      amount: 500 * 1e6, // 500 токенов
      mint
    });
    console.log('✅ Карта пополнена:', topUpSignature);
    
    // 3. Проверка баланса
    console.log('🔍 Проверка баланса...');
    const cardData = await bridge.getCard(wallet.publicKey, cardId);
    console.log('💳 Баланс карты:', cardData?.balance / 1e6, 'токенов');
    
    // 4. Обработка платежа
    console.log('💸 Обработка платежа...');
    const paymentSignature = await bridge.processPayment({
      cardId,
      amount: 100 * 1e6, // 100 токенов
      merchantTokenAccount: merchantTokenAccount, // предполагается, что определен
      merchant: merchantPubkey, // предполагается, что определен
      merchantReference: 'TEST-ORDER-123'
    });
    console.log('✅ Платеж обработан:', paymentSignature);
    
    // 5. Деактивация карты
    console.log('🔒 Деактивация карты...');
    const deactivateSignature = await bridge.deactivateCard(cardId);
    console.log('✅ Карта деактивирована:', deactivateSignature);
    
    // 6. Вывод остатка
    console.log('💸 Вывод остатка...');
    const withdrawSignature = await bridge.withdrawBalance(cardId, mint);
    console.log('✅ Остаток выведен:', withdrawSignature);
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  }
}

// Запуск примера
cardLifecycleExample();
```

### Мониторинг событий

```typescript
async function monitorEvents() {
  const connection = new Connection('https://api.devnet.solana.com');
  const bridge = new AurexSolanaBridge(connection, wallet);
  
  console.log('🔍 Запуск мониторинга событий...');
  
  // Слушать создание карт
  bridge.onCardCreated((event) => {
    console.log('🆕 Новая карта создана:');
    console.log(`  ID: ${event.cardId}`);
    console.log(`  Владелец: ${event.owner.toBase58()}`);
    console.log(`  Лимит: ${event.balanceLimit / 1e6} токенов`);
  });
  
  // Слушать платежи
  bridge.onPaymentProcessed((event) => {
    console.log('💰 Платеж обработан:');
    console.log(`  Сумма: ${event.amount / 1e6} токенов`);
    console.log(`  Ссылка: ${event.merchantReference}`);
    console.log(`  Остаток: ${event.remainingBalance / 1e6} токенов`);
  });
  
  // Держать программу запущенной
  console.log('Мониторинг запущен. Нажмите Ctrl+C для выхода.');
  process.stdin.resume();
}
```

## Тестирование

```bash
npm run test
```

## Сборка

```bash
npm run build
```

## Типизация

SDK полностью типизирован с TypeScript. Включите строгую типизацию в вашем проекте:

```typescript
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

## Поддержка

Если у вас возникли проблемы с SDK:

1. Проверьте [документацию](../README.ru.md)
2. Ознакомьтесь с [примерами](../examples/)
3. Создайте issue в [GitHub](https://github.com/aurexcashgit/aurex-solana-bridge/issues)