# 🎮 StakePro Seamless Wallet API Documentation

## Overview

The StakePro Seamless Wallet API allows external game providers to integrate with our platform. This API enables providers to check user balances and process transactions (bets, wins, refunds) in real-time.

---

## Base URL

```
https://your-domain.com/api/integration
```

**Production:** `https://stakepro.com/api/integration`  
**Staging:** `https://staging.stakepro.com/api/integration`

---

## Authentication

All requests must include the `X-API-KEY` header with a valid API key.

| Header | Value | Required |
|--------|-------|----------|
| `X-API-KEY` | Your provider API key | ✅ Yes |
| `Content-Type` | `application/json` | ✅ Yes |

---

## Endpoints

### 1. Get Balance

Retrieve the current balance for a user.

**Endpoint:** `POST /api/integration/balance`

#### Request

```json
{
  "userId": "user_abc123",
  "currency": "USDT"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | string | ✅ Yes | The unique user identifier |
| `currency` | string | ❌ No | Currency code (default: "USDT") |

#### Response - Success

```json
{
  "status": "OK",
  "balance": 1250.50,
  "currency": "USDT"
}
```

#### Response - Error

```json
{
  "status": "ERROR",
  "error": "User not found"
}
```

#### Example cURL

```bash
curl -X POST https://your-domain.com/api/integration/balance \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: your_api_key_here" \
  -d '{
    "userId": "user_abc123",
    "currency": "USDT"
  }'
```

---

### 2. Process Transaction

Process a bet, win, or refund transaction.

**Endpoint:** `POST /api/integration/transaction`

#### Request

```json
{
  "userId": "user_abc123",
  "amount": 50.00,
  "type": "BET",
  "gameId": "dragon_crash",
  "transactionId": "ext_tx_12345",
  "roundId": "round_789",
  "currency": "USDT"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | string | ✅ Yes | The unique user identifier |
| `amount` | number | ✅ Yes | Transaction amount (min: 0.01) |
| `type` | string | ✅ Yes | Transaction type: `BET`, `WIN`, or `REFUND` |
| `gameId` | string | ✅ Yes | Identifier of the game |
| `transactionId` | string | ✅ Yes | Unique transaction ID from provider (for idempotency) |
| `roundId` | string | ❌ No | Game round identifier |
| `currency` | string | ❌ No | Currency code (default: "USDT") |

#### Transaction Types

| Type | Description | Balance Effect |
|------|-------------|----------------|
| `BET` | User places a bet | Balance decreases |
| `WIN` | User wins | Balance increases |
| `REFUND` | Refund a previous bet | Balance increases |

#### Response - Success

```json
{
  "status": "OK",
  "newBalance": 1200.50,
  "txId": "internal_tx_67890"
}
```

#### Response - Error

```json
{
  "status": "ERROR",
  "error": "Insufficient funds",
  "errorCode": "INSUFFICIENT_FUNDS"
}
```

#### Error Codes

| Code | Description |
|------|-------------|
| `INSUFFICIENT_FUNDS` | User doesn't have enough balance for the bet |
| `USER_NOT_FOUND` | User ID doesn't exist in the system |
| `DUPLICATE_TRANSACTION` | Transaction ID already processed (idempotent) |
| `INVALID_AMOUNT` | Amount is invalid (negative or zero) |
| `USER_BLOCKED` | User account is blocked or suspended |
| `INTERNAL_ERROR` | Server error - contact support |

#### Example cURL - BET

```bash
curl -X POST https://your-domain.com/api/integration/transaction \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: your_api_key_here" \
  -d '{
    "userId": "user_abc123",
    "amount": 50.00,
    "type": "BET",
    "gameId": "dragon_crash",
    "transactionId": "ext_tx_12345"
  }'
```

#### Example cURL - WIN

```bash
curl -X POST https://your-domain.com/api/integration/transaction \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: your_api_key_here" \
  -d '{
    "userId": "user_abc123",
    "amount": 125.00,
    "type": "WIN",
    "gameId": "dragon_crash",
    "transactionId": "ext_tx_12346"
  }'
```

---

### 3. Rollback Transaction

Rollback a previously processed transaction.

**Endpoint:** `POST /api/integration/rollback`

#### Request

```json
{
  "transactionId": "ext_tx_12345"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `transactionId` | string | ✅ Yes | The original transaction ID to rollback |

#### Response - Success

```json
{
  "status": "OK",
  "newBalance": 1250.50,
  "txId": "internal_tx_67890"
}
```

#### Example cURL

```bash
curl -X POST https://your-domain.com/api/integration/rollback \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: your_api_key_here" \
  -d '{
    "transactionId": "ext_tx_12345"
  }'
```

---

### 4. Health Check

Check if the API is operational.

**Endpoint:** `POST /api/integration/health`

#### Response

```json
{
  "status": "OK",
  "timestamp": "2024-02-04T12:00:00.000Z"
}
```

#### Example cURL

```bash
curl -X POST https://your-domain.com/api/integration/health \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: your_api_key_here"
```

---

## Idempotency

The API is **idempotent** for transaction processing. If you send the same `transactionId` multiple times:

1. The first request will process the transaction
2. Subsequent requests will return the same result without re-processing

This ensures that network issues or retries don't result in duplicate charges.

---

## Rate Limits

| Endpoint | Rate Limit |
|----------|------------|
| `/balance` | 100 requests/second |
| `/transaction` | 50 requests/second |
| `/rollback` | 20 requests/second |

---

## Best Practices

1. **Always use unique transaction IDs** - Generate a unique ID for each transaction to ensure idempotency
2. **Handle errors gracefully** - Check the `status` field and handle error codes appropriately
3. **Implement retry logic** - For network failures, retry with exponential backoff
4. **Log all transactions** - Keep records of all API calls for reconciliation
5. **Test in staging first** - Use the staging environment before going live

---

## Support

For technical support or API key requests, contact:

- **Email:** integration@stakepro.com
- **Documentation:** https://docs.stakepro.com/integration

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2024-02-04 | Initial release |

---

*Last updated: February 4, 2024*
