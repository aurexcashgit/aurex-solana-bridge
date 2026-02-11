# API Reference

The Aurex Solana Bridge API provides HTTP endpoints for managing virtual cards and payments.

## Base URL

- **Devnet**: `http://localhost:3000`
- **Production**: `https://bridge-api.aurex.cash`

## Authentication

All endpoints require authentication using Bearer tokens:

```
Authorization: Bearer <your-aurex-token>
```

## Endpoints

### Health Check

#### `GET /health`
Returns the health status of the API.

**Response:**
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

### Bridge Status

#### `GET /api/v1/bridge/status`
Returns the bridge state and Solana cluster information.

**Response:**
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

### Cards

#### `POST /api/v1/cards`
Creates a new virtual card.

**Request Body:**
```json
{
  "balanceLimit": 1000,
  "metadata": "Personal card",
  "mint": "So11111111111111111111111111111111111111112"
}
```

**Response:**
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
Gets all cards for the authenticated user.

**Response:**
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
      "metadata": "Personal card",
      "createdAt": "2024-02-11T15:30:00.000Z",
      "solanaData": {
        "id": "uuid-v4-card-id",
        "owner": "...",
        "balance": 500,
        "balanceLimit": 1000,
        "isActive": true,
        "metadata": "Personal card",
        "createdAt": 1707667800,
        "bump": 255
      }
    }
  ]
}
```

#### `POST /api/v1/cards/:cardId/topup`
Tops up a virtual card with funds.

**Request Body:**
```json
{
  "amount": 100,
  "mint": "So11111111111111111111111111111111111111112"
}
```

**Response:**
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
Deactivates a virtual card.

**Response:**
```json
{
  "success": true,
  "data": {
    "cardId": "uuid-v4-card-id",
    "txSignature": "transaction-signature"
  }
}
```

### Payments

#### `POST /api/v1/payments`
Processes a payment from a virtual card.

**Request Body:**
```json
{
  "cardId": "uuid-v4-card-id",
  "amount": 50,
  "merchantId": "merchant-123",
  "merchantReference": "ORDER-12345"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "paymentId": "payment-uuid",
    "cardId": "uuid-v4-card-id",
    "amount": 50,
    "merchant": "Merchant Name",
    "txSignature": "transaction-signature",
    "remainingBalance": 450
  }
}
```

#### `GET /api/v1/payments`
Gets payment history for the authenticated user.

**Query Parameters:**
- `cardId` (optional): Filter by specific card
- `limit` (optional): Number of results (default: 50)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
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
Endpoint for receiving Solana blockchain events.

**Request Body:**
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

## Error Responses

All error responses follow this format:

```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

### HTTP Status Codes

- `200` - Success
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (invalid or missing token)
- `404` - Not Found (resource doesn't exist)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error

## Rate Limiting

The API implements rate limiting:

- **Limit**: 100 requests per 15-minute window
- **Headers**: Rate limit information is included in response headers
  - `X-RateLimit-Limit`: Maximum requests allowed
  - `X-RateLimit-Remaining`: Remaining requests in current window
  - `X-RateLimit-Reset`: Unix timestamp when the window resets

## Environment Configuration

Required environment variables:

```env
PORT=3000
NODE_ENV=development
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_PRIVATE_KEY=[1,2,3...] # JSON array of private key bytes
AUREX_API_URL=https://api.aurex.cash
AUREX_API_KEY=your-aurex-api-key
LOG_LEVEL=info
```

## Development

Start the development server:

```bash
cd api
npm run dev
```

Build for production:

```bash
npm run build
npm start
```

## Testing

```bash
npm run test
```

## Monitoring

The API includes comprehensive logging using Winston. Logs are written to:

- `logs/combined.log` - All logs
- `logs/error.log` - Error logs only
- Console output (development only)