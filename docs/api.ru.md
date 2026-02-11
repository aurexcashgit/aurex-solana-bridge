# Справочник API

Aurex Solana Bridge API предоставляет HTTP endpoints для управления виртуальными картами и платежами.

## Базовый URL

- **Devnet**: `http://localhost:3000`
- **Production**: `https://bridge-api.aurex.cash`

## Аутентификация

Все endpoints требуют аутентификации с использованием Bearer токенов:

```
Authorization: Bearer <ваш-aurex-токен>
```

## Endpoints

### Проверка здоровья

#### `GET /health`
Возвращает статус здоровья API.

**Ответ:**
```json
{
  "status": "ok",
  "timestamp": "2024-02-11T15:30:00.000Z",
  "version": "0.1.0",
  "solana": {
    "cluster": "https://api.devnet.solana.com",
    "programId": "AuRex11111111111111111111111111111111111111"
  }
}
```

### Статус моста

#### `GET /api/v1/bridge/status`
Возвращает состояние моста и информацию о кластере Solana.

**Ответ:**
```json
{
  "success": true,
  "data": {
    "bridgeState": {
      "authority": "...",
      "totalCards": 42,
      "bump": 255
    },
    "solana": {
      "blockHeight": 234567890,
      "cluster": "https://api.devnet.solana.com"
    }
  }
}
```

### Карты

#### `POST /api/v1/cards`
Создает новую виртуальную карту.

**Тело запроса:**
```json
{
  "balanceLimit": 1000,
  "metadata": "Личная карта",
  "mint": "So11111111111111111111111111111111111111112"
}
```

**Параметры:**
- `balanceLimit` (number): Максимальный баланс карты в токенах
- `metadata` (string, optional): Описание карты
- `mint` (string): Адрес токен-минта

**Ответ:**
```json
{
  "success": true,
  "data": {
    "cardId": "uuid-v4-card-id",
    "cardPubkey": "solana-public-key",
    "escrowPubkey": "escrow-public-key",
    "txSignature": "transaction-signature",
    "balanceLimit": 1000
  }
}
```

#### `GET /api/v1/cards`
Получает все карты аутентифицированного пользователя.

**Ответ:**
```json
{
  "success": true,
  "data": [
    {
      "cardId": "uuid-v4-card-id",
      "userId": "user-123",
      "solanaPubkey": "...",
      "escrowPubkey": "...",
      "balanceLimit": 1000,
      "balance": 500,
      "isActive": true,
      "metadata": "Личная карта",
      "createdAt": "2024-02-11T15:30:00.000Z",
      "solanaData": {
        "id": "uuid-v4-card-id",
        "owner": "...",
        "balance": 500,
        "balanceLimit": 1000,
        "isActive": true,
        "metadata": "Личная карта",
        "createdAt": 1707667800,
        "bump": 255
      }
    }
  ]
}
```

#### `POST /api/v1/cards/:cardId/topup`
Пополняет виртуальную карту средствами.

**Параметры URL:**
- `cardId` (string): ID карты для пополнения

**Тело запроса:**
```json
{
  "amount": 100,
  "mint": "So11111111111111111111111111111111111111112"
}
```

**Параметры:**
- `amount` (number): Сумма для пополнения в токенах
- `mint` (string): Адрес токен-минта

**Ответ:**
```json
{
  "success": true,
  "data": {
    "cardId": "uuid-v4-card-id",
    "amount": 100,
    "txSignature": "transaction-signature"
  }
}
```

#### `DELETE /api/v1/cards/:cardId`
Деактивирует виртуальную карту.

**Параметры URL:**
- `cardId` (string): ID карты для деактивации

**Ответ:**
```json
{
  "success": true,
  "data": {
    "cardId": "uuid-v4-card-id",
    "txSignature": "transaction-signature"
  }
}
```

### Платежи

#### `POST /api/v1/payments`
Обрабатывает платеж с виртуальной карты.

**Тело запроса:**
```json
{
  "cardId": "uuid-v4-card-id",
  "amount": 50,
  "merchantId": "merchant-123",
  "merchantReference": "ORDER-12345"
}
```

**Параметры:**
- `cardId` (string): ID карты для платежа
- `amount` (number): Сумма платежа в токенах
- `merchantId` (string): ID продавца
- `merchantReference` (string): Ссылка продавца на заказ

**Ответ:**
```json
{
  "success": true,
  "data": {
    "paymentId": "payment-uuid",
    "cardId": "uuid-v4-card-id",
    "amount": 50,
    "merchant": "Название продавца",
    "txSignature": "transaction-signature",
    "remainingBalance": 450
  }
}
```

#### `GET /api/v1/payments`
Получает историю платежей аутентифицированного пользователя.

**Параметры запроса:**
- `cardId` (optional): Фильтр по конкретной карте
- `limit` (optional): Количество результатов (по умолчанию: 50)
- `offset` (optional): Смещение пагинации (по умолчанию: 0)

**Ответ:**
```json
{
  "success": true,
  "data": [
    {
      "id": "payment-uuid",
      "cardId": "uuid-v4-card-id",
      "merchantId": "merchant-123",
      "amount": 50,
      "merchantReference": "ORDER-12345",
      "solanaSignature": "transaction-signature",
      "status": "completed",
      "createdAt": "2024-02-11T15:30:00.000Z"
    }
  ]
}
```

### Webhooks

#### `POST /api/v1/webhooks/solana`
Endpoint для получения событий блокчейна Solana.

**Тело запроса:**
```json
{
  "signature": "transaction-signature",
  "accountId": "account-public-key",
  "eventType": "payment_processed",
  "data": {
    "cardId": "uuid-v4-card-id",
    "amount": 50,
    "merchant": "merchant-public-key"
  }
}
```

## Ответы об ошибках

Все ответы об ошибках следуют этому формату:

```json
{
  "success": false,
  "error": "Сообщение об ошибке, описывающее что пошло не так"
}
```

### HTTP статус коды

- `200` - Успех
- `400` - Неверный запрос (ошибки валидации)
- `401` - Неавторизован (неверный или отсутствующий токен)
- `404` - Не найдено (ресурс не существует)
- `429` - Слишком много запросов (превышен лимит)
- `500` - Внутренняя ошибка сервера

## Лимиты запросов

API реализует ограничение запросов:

- **Лимит**: 100 запросов за 15-минутное окно
- **Заголовки**: Информация о лимите включается в заголовки ответа
  - `X-RateLimit-Limit`: Максимум разрешенных запросов
  - `X-RateLimit-Remaining`: Оставшиеся запросы в текущем окне
  - `X-RateLimit-Reset`: Unix timestamp сброса окна

**Пример заголовков:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 85
X-RateLimit-Reset: 1707667800
```

## Конфигурация окружения

Необходимые переменные окружения:

```env
PORT=3000
NODE_ENV=development
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_PRIVATE_KEY=[1,2,3...] # JSON массив байтов приватного ключа
AUREX_API_URL=https://api.aurex.cash
AUREX_API_KEY=ваш-aurex-api-ключ
LOG_LEVEL=info
```

## Примеры использования

### Создание и использование карты

```bash
# 1. Создание карты
curl -X POST http://localhost:3000/api/v1/cards \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "balanceLimit": 1000,
    "metadata": "Моя тестовая карта",
    "mint": "So11111111111111111111111111111111111111112"
  }'

# 2. Пополнение карты
curl -X POST http://localhost:3000/api/v1/cards/uuid-карты/topup \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 500,
    "mint": "So11111111111111111111111111111111111111112"
  }'

# 3. Обработка платежа
curl -X POST http://localhost:3000/api/v1/payments \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "cardId": "uuid-карты",
    "amount": 100,
    "merchantId": "test-merchant-1",
    "merchantReference": "ORDER-123"
  }'

# 4. Проверка истории платежей
curl -X GET "http://localhost:3000/api/v1/payments?limit=10" \
  -H "Authorization: Bearer your-token"
```

### JavaScript/TypeScript пример

```typescript
const API_BASE = 'http://localhost:3000';
const AUTH_TOKEN = 'your-token';

async function apiRequest(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${AUTH_TOKEN}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'API request failed');
  }
  
  return data;
}

// Создание карты
async function createCard() {
  try {
    const result = await apiRequest('/api/v1/cards', {
      method: 'POST',
      body: JSON.stringify({
        balanceLimit: 1000,
        metadata: 'Автоматически созданная карта',
        mint: 'So11111111111111111111111111111111111111112'
      })
    });
    
    console.log('Карта создана:', result.data);
    return result.data;
  } catch (error) {
    console.error('Ошибка создания карты:', error.message);
  }
}

// Пополнение карты
async function topUpCard(cardId: string, amount: number) {
  try {
    const result = await apiRequest(`/api/v1/cards/${cardId}/topup`, {
      method: 'POST',
      body: JSON.stringify({
        amount,
        mint: 'So11111111111111111111111111111111111111112'
      })
    });
    
    console.log('Карта пополнена:', result.data);
    return result.data;
  } catch (error) {
    console.error('Ошибка пополнения карты:', error.message);
  }
}

// Получение карт пользователя
async function getUserCards() {
  try {
    const result = await apiRequest('/api/v1/cards');
    console.log('Карты пользователя:', result.data);
    return result.data;
  } catch (error) {
    console.error('Ошибка получения карт:', error.message);
  }
}

// Использование
async function example() {
  // Создаем карту
  const card = await createCard();
  
  if (card) {
    // Пополняем карту
    await topUpCard(card.cardId, 100);
    
    // Получаем все карты
    const cards = await getUserCards();
    console.log(`Всего карт: ${cards.length}`);
  }
}
```

## WebSocket события (планируется)

В будущих версиях API будет поддерживать WebSocket соединения для получения событий в реальном времени:

```javascript
// Планируемый API
const ws = new WebSocket('ws://localhost:3000/ws');

ws.on('message', (data) => {
  const event = JSON.parse(data);
  
  switch (event.type) {
    case 'card_created':
      console.log('Новая карта создана:', event.data);
      break;
    case 'payment_processed':
      console.log('Платеж обработан:', event.data);
      break;
  }
});
```

## Разработка

Запуск сервера разработки:

```bash
cd api
npm run dev
```

Сборка для продакшена:

```bash
npm run build
npm start
```

## Тестирование

```bash
npm run test
```

## Мониторинг

API включает встроенные возможности мониторинга:

- **Prometheus метрики**: `http://localhost:9464/metrics`
- **Логи**: структурированные JSON логи с Winston
- **Health check**: `GET /health` для проверки состояния

## Безопасность

- **Rate limiting**: Защита от DDoS атак
- **Input validation**: Валидация всех входных данных
- **CORS**: Настраиваемые CORS политики
- **Helmet**: Безопасные HTTP заголовки
- **JWT validation**: Проверка токенов аутентификации

## Развертывание

### Docker

```bash
# Сборка образа
docker build -t aurex-bridge-api .

# Запуск контейнера
docker run -p 3000:3000 --env-file .env aurex-bridge-api
```

### Docker Compose

```bash
# Запуск полного стека
docker-compose up -d

# Просмотр логов
docker-compose logs -f aurex-bridge-api
```